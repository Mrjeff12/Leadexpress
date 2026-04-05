import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    let fixed = 0;
    let flagged = 0;

    // ── 1. Find stale pending withdrawals (older than 1 hour) ───────
    const { data: staleCommissions, error: fetchErr } = await supabase
      .from("partner_commissions")
      .select("id, partner_id, amount_cents, stripe_payout_id")
      .eq("type", "withdrawal")
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (fetchErr) {
      console.error("[reconcile-payouts] Fetch stale commissions error:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }

    // ── 2. For each stale withdrawal, check Stripe for a matching transfer ──
    for (const comm of staleCommissions ?? []) {
      try {
        // Search Stripe transfers by metadata
        const transfers = await stripe.transfers.list({
          limit: 5,
        });

        // Find transfer matching this commission
        const match = transfers.data.find(
          (t) => t.metadata?.commission_id === comm.id,
        );

        if (match) {
          // Transfer exists in Stripe but commission still pending → fix it
          const { error: updateErr } = await supabase
            .from("partner_commissions")
            .update({
              status: "paid",
              stripe_payout_id: match.id,
              paid_at: new Date(match.created * 1000).toISOString(),
            })
            .eq("id", comm.id)
            .eq("status", "pending");

          if (!updateErr) {
            fixed++;
            await logReconciliation("commission", comm.id, "auto_fixed", {
              stripe_transfer_id: match.id,
              reason: "Transfer found in Stripe but commission was still pending",
            });
            console.log(`[reconcile-payouts] Auto-fixed commission ${comm.id} → transfer ${match.id}`);
          }
        } else {
          // No transfer found — flag for admin review
          flagged++;
          await logReconciliation("commission", comm.id, "needs_review", {
            reason: "Pending withdrawal older than 1h with no matching Stripe transfer",
            partner_id: comm.partner_id,
            amount_cents: comm.amount_cents,
          });
          console.warn(`[reconcile-payouts] Flagged commission ${comm.id} for review`);
        }
      } catch (stripeErr) {
        console.error(`[reconcile-payouts] Stripe lookup error for ${comm.id}:`, stripeErr);
      }
    }

    // ── 3. Check recent Stripe transfers have matching paid records ──
    try {
      const recentTransfers = await stripe.transfers.list({
        limit: 50,
        created: { gte: Math.floor(Date.now() / 1000) - 24 * 60 * 60 },
      });

      for (const transfer of recentTransfers.data) {
        const commissionId = transfer.metadata?.commission_id;
        if (!commissionId) continue;

        const { data: comm } = await supabase
          .from("partner_commissions")
          .select("id, status, stripe_payout_id")
          .eq("id", commissionId)
          .single();

        if (!comm) {
          flagged++;
          await logReconciliation("transfer", transfer.id, "needs_review", {
            reason: "Stripe transfer has commission_id in metadata but no matching DB record",
            commission_id: commissionId,
            amount: transfer.amount,
          });
        } else if (comm.status === "pending") {
          // Auto-fix: transfer went through but DB wasn't updated
          const { error: fixErr } = await supabase
            .from("partner_commissions")
            .update({
              status: "paid",
              stripe_payout_id: transfer.id,
              paid_at: new Date(transfer.created * 1000).toISOString(),
            })
            .eq("id", commissionId)
            .eq("status", "pending");

          if (!fixErr) {
            fixed++;
            await logReconciliation("commission", commissionId, "auto_fixed", {
              stripe_transfer_id: transfer.id,
              reason: "Transfer completed but commission was still pending (reverse lookup)",
            });
          }
        }
      }
    } catch (err) {
      console.error("[reconcile-payouts] Reverse lookup error:", err);
    }

    console.log(`[reconcile-payouts] Done. Fixed: ${fixed}, Flagged: ${flagged}`);
    return new Response(JSON.stringify({ ok: true, fixed, flagged }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[reconcile-payouts] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});

async function logReconciliation(
  entityType: string,
  entityId: string,
  action: string,
  detail: Record<string, unknown>,
) {
  await supabase.from("reconciliation_log").insert({
    source: "reconcile-payouts",
    entity_type: entityType,
    entity_id: entityId,
    action,
    detail,
  });
}

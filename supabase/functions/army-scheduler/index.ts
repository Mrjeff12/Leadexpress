import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

interface Assignment {
  id: string
  wa_account_id: string
  group_wa_id: string
  group_name: string | null
  role_in_group: string
}

interface Template {
  id: string
  body: string
  placeholders: string[]
}

interface WaAccount {
  id: string
  green_api_id: string
  green_api_token: string
  green_api_url: string
}

Deno.serve(async (_req: Request) => {
  try {
    // 1. Check if enabled
    const { data: configRows } = await supabase.from("army_config").select("key, value")
    const config = Object.fromEntries((configRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))

    if (config.enabled === "false") {
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    // 2. Check activity window (in target timezone, default US Eastern)
    const now = new Date()
    const tz = config.timezone ?? "America/New_York"
    const localTime = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(now)
    const currentHHMM = localTime.replace(/^24:/, "00:")
    const windowStart = config.activity_window_start ?? "07:00"
    const windowEnd = config.activity_window_end ?? "21:00"

    if (currentHHMM < windowStart || currentHHMM > windowEnd) {
      return new Response(JSON.stringify({ ok: true, skipped: "outside_window" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    // 3. Get active assignments
    const { data: assignments } = await supabase
      .from("army_assignments")
      .select("*")
      .eq("is_active", true)

    if (!assignments?.length) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_assignments" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    // 4. Get today's already-scheduled entries to avoid duplicates
    const todayStart = new Date(now)
    todayStart.setUTCHours(0, 0, 0, 0)
    const { data: todaySchedule } = await supabase
      .from("army_schedule")
      .select("group_wa_id, wa_account_id, message_type")
      .gte("scheduled_at", todayStart.toISOString())

    const alreadySent = new Set(
      (todaySchedule ?? []).map((s: { group_wa_id: string; wa_account_id: string; message_type: string }) =>
        `${s.group_wa_id}::${s.wa_account_id}::${s.message_type}`
      )
    )

    // 5. Get templates by category
    const { data: allTemplates } = await supabase
      .from("army_templates")
      .select("*")
      .eq("is_active", true)

    const templatesByCategory: Record<string, Template[]> = {}
    for (const t of allTemplates ?? []) {
      const cat = (t as { category: string }).category
      if (!templatesByCategory[cat]) templatesByCategory[cat] = []
      templatesByCategory[cat].push(t as Template)
    }

    // 6. Get wa_accounts for sending
    const accountIds = [...new Set(assignments.map((a: Assignment) => a.wa_account_id))]
    const { data: accountRows } = await supabase
      .from("wa_accounts")
      .select("id, green_api_id, green_api_token, green_api_url")
      .in("id", accountIds)
      .eq("status", "connected")

    const accountMap = new Map((accountRows ?? []).map((a: WaAccount) => [a.id, a]))

    // 7. Group assignments by group
    const byGroup = new Map<string, Assignment[]>()
    for (const a of assignments as Assignment[]) {
      if (!byGroup.has(a.group_wa_id)) byGroup.set(a.group_wa_id, [])
      byGroup.get(a.group_wa_id)!.push(a)
    }

    const delayMin = parseInt(config.response_delay_min ?? "5", 10)
    const delayMax = parseInt(config.response_delay_max ?? "30", 10)
    let sentCount = 0
    let errorCount = 0

    // 8. Process each group
    for (const [groupId, groupAssignments] of byGroup) {
      const publishers = groupAssignments.filter(a => a.role_in_group === "publisher")
      const responders = groupAssignments.filter(a => a.role_in_group === "responder")
      const contractors = groupAssignments.filter(a => a.role_in_group === "contractor")

      // Send job post
      for (const pub of publishers) {
        const key = `${groupId}::${pub.wa_account_id}::job_post`
        if (alreadySent.has(key)) continue

        const templates = templatesByCategory["job_post"] ?? []
        if (!templates.length) continue
        const tpl = templates[Math.floor(Math.random() * templates.length)]
        const account = accountMap.get(pub.wa_account_id)
        if (!account) continue

        const message = fillPlaceholders(tpl.body)
        const result = await sendMessage(account, groupId, message)

        await supabase.from("army_schedule").insert({
          group_wa_id: groupId,
          wa_account_id: pub.wa_account_id,
          template_id: tpl.id,
          message_type: "job_post",
          scheduled_at: now.toISOString(),
          sent_at: result.ok ? now.toISOString() : null,
          status: result.ok ? "sent" : "failed",
          rendered_message: message,
          error: result.error ?? null,
        })

        if (result.ok) sentCount++
        else errorCount++
        alreadySent.add(key)
      }

      // Send responses (with delay simulated by scheduling later)
      for (const resp of responders) {
        const key = `${groupId}::${resp.wa_account_id}::response`
        if (alreadySent.has(key)) continue

        const templates = templatesByCategory["response"] ?? []
        if (!templates.length) continue
        const tpl = templates[Math.floor(Math.random() * templates.length)]
        const account = accountMap.get(resp.wa_account_id)
        if (!account) continue

        // Random delay (5-30 min) before responding
        const delayMs = (delayMin + Math.random() * (delayMax - delayMin)) * 60 * 1000
        await sleep(Math.min(delayMs, 5000)) // cap at 5s in edge function context

        const message = fillPlaceholders(tpl.body)
        const result = await sendMessage(account, groupId, message)

        await supabase.from("army_schedule").insert({
          group_wa_id: groupId,
          wa_account_id: resp.wa_account_id,
          template_id: tpl.id,
          message_type: "response",
          scheduled_at: now.toISOString(),
          sent_at: result.ok ? now.toISOString() : null,
          status: result.ok ? "sent" : "failed",
          rendered_message: message,
          error: result.error ?? null,
        })

        if (result.ok) sentCount++
        else errorCount++
        alreadySent.add(key)
      }

      // Send contractor promos
      for (const con of contractors) {
        const key = `${groupId}::${con.wa_account_id}::contractor_promo`
        if (alreadySent.has(key)) continue

        const templates = templatesByCategory["contractor_promo"] ?? []
        if (!templates.length) continue
        const tpl = templates[Math.floor(Math.random() * templates.length)]
        const account = accountMap.get(con.wa_account_id)
        if (!account) continue

        const message = fillPlaceholders(tpl.body)
        const result = await sendMessage(account, groupId, message)

        await supabase.from("army_schedule").insert({
          group_wa_id: groupId,
          wa_account_id: con.wa_account_id,
          template_id: tpl.id,
          message_type: "contractor_promo",
          scheduled_at: now.toISOString(),
          sent_at: result.ok ? now.toISOString() : null,
          status: result.ok ? "sent" : "failed",
          rendered_message: message,
          error: result.error ?? null,
        })

        if (result.ok) sentCount++
        else errorCount++
        alreadySent.add(key)
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: sentCount, errors: errorCount }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

/* ─── Helpers ─── */

function fillPlaceholders(body: string): string {
  const replacements: Record<string, string[]> = {
    "{profession}": ["Plumber", "Electrician", "HVAC Tech", "Painter", "Roofer", "General Contractor"],
    "{city}": ["Miami", "Fort Lauderdale", "Orlando", "Tampa", "Jacksonville"],
    "{state}": ["FL"],
    "{price_range}": ["$1,500 - $3,000", "$2,000 - $5,000", "$3,000 - $7,000", "$500 - $1,500"],
    "{job_link}": ["masterlead.app/jobs"],
    "{name}": ["Mike R.", "David S.", "Carlos M.", "James T.", "Robert H."],
    "{experience_years}": ["5", "8", "12", "15", "20"],
    "{rating}": ["4.7", "4.8", "4.9", "5.0"],
    "{completed_jobs}": ["23", "35", "47", "62", "89"],
    "{profile_link}": ["masterlead.app/pro"],
  }

  let result = body
  for (const [key, options] of Object.entries(replacements)) {
    result = result.replaceAll(key, options[Math.floor(Math.random() * options.length)])
  }
  return result
}

async function sendMessage(
  account: WaAccount,
  groupId: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${account.green_api_url}/waInstance${account.green_api_id}/sendMessage/${account.green_api_token}`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: groupId.includes("@") ? groupId : `${groupId}@g.us`,
        message,
      }),
    })
    const data = await res.json()
    if (data.idMessage) return { ok: true }
    return { ok: false, error: JSON.stringify(data) }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

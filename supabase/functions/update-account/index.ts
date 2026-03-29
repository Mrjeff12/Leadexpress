import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip, 3, 60_000)) {
    return rateLimitResponse(corsHeaders);
  }

  // Always return 200 so supabase.functions.invoke() can read the error message
  const json = (data: unknown) =>
    new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Not authenticated' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return json({ error: 'Invalid session. Please log in again.' });
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return json({ error: 'Email and password required' });
    }

    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email is already taken by another user
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailTaken = existingUsers?.users?.some(
      (u) => u.email === email && u.id !== user.id
    );
    if (emailTaken) {
      return json({ error: 'This email is already in use. Please use a different email.' });
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
      email,
      password,
      email_confirm: true,
    });

    if (updateErr) {
      console.error('[update-account] Error:', updateErr);
      return json({ error: updateErr.message });
    }

    console.log(`[update-account] Updated email+password for user ${user.id}`);
    return json({ success: true });

  } catch (err) {
    console.error('[update-account] Error:', err);
    return json({ error: 'Something went wrong. Please try again.' });
  }
});

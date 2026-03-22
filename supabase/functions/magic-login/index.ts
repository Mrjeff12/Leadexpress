import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = Deno.env.get('SITE_URL') || 'https://app.masterleadflow.com';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { action, token, user_id, redirect_path, phone } = await req.json();

    // ── ACTION: generate — create a new magic token for a user ──
    if (action === 'generate') {
      if (!user_id && !phone) {
        return json({ error: 'user_id or phone required' }, 400);
      }

      let targetUserId = user_id;

      // Find user by phone if no user_id provided
      if (!targetUserId && phone) {
        const stripped = phone.replace(/^\+/, '');
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .or(`whatsapp_phone.eq.+${stripped},whatsapp_phone.eq.${stripped},phone.eq.+${stripped},phone.eq.${stripped}`)
          .maybeSingle();
        if (!profile) {
          return json({ error: 'User not found' }, 404);
        }
        targetUserId = profile.id;
      }

      // Create token
      const { data: tokenRow, error } = await supabase
        .from('magic_login_tokens')
        .insert({
          user_id: targetUserId,
          redirect_path: redirect_path || '/',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
        })
        .select('token')
        .single();

      if (error) {
        return json({ error: error.message }, 500);
      }

      const link = `${SITE_URL}/auto-login?token=${tokenRow.token}`;
      return json({ link, token: tokenRow.token, expires_in: '1 hour' });
    }

    // ── ACTION: exchange — exchange token for a session ──
    if (action === 'exchange') {
      if (!token) {
        return json({ error: 'token required' }, 400);
      }

      // Find valid token
      const { data: tokenRow, error: findErr } = await supabase
        .from('magic_login_tokens')
        .select('user_id, redirect_path, expires_at, used_at')
        .eq('token', token)
        .maybeSingle();

      if (findErr || !tokenRow) {
        return json({ error: 'Invalid or expired token' }, 401);
      }

      if (tokenRow.used_at) {
        return json({ error: 'Token already used' }, 401);
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        return json({ error: 'Token expired' }, 401);
      }

      // Mark as used
      await supabase
        .from('magic_login_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      // Ensure user has an email (required for Supabase auth)
      const { data: userData } = await supabase.auth.admin.getUserById(tokenRow.user_id);
      if (!userData?.user) {
        return json({ error: 'User not found' }, 404);
      }

      const email = userData.user.email || `wa-${tokenRow.user_id.slice(0, 8)}@app.masterleadflow.com`;

      // Set email if not present
      if (!userData.user.email) {
        await supabase.auth.admin.updateUserById(tokenRow.user_id, { email, email_confirm: true });
      }

      // Generate session tokens directly (no redirect dependency)
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        console.error('[magic-login] Link error:', linkErr);
        return json({ error: 'Could not generate session' }, 500);
      }

      // Verify the OTP to get actual session tokens
      const { data: sessionData, error: sessionErr } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: linkData.properties.hashed_token,
      });

      if (sessionErr || !sessionData?.session) {
        console.error('[magic-login] Session error:', sessionErr);
        return json({ error: 'Could not create session' }, 500);
      }

      // Return tokens — client calls setSession()
      return json({
        redirect_path: tokenRow.redirect_path,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        type: 'session',
      });
    }

    return json({ error: 'Invalid action. Use "generate" or "exchange"' }, 400);
  } catch (err) {
    console.error('[magic-login]', err);
    return json({ error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

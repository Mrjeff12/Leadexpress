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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  // ── Auth: require admin JWT ──
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or invalid Authorization header' }, 401);
  }
  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !caller) {
    return json({ error: 'Invalid token' }, 401);
  }
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();
  if (!callerProfile || callerProfile.role !== 'admin') {
    return json({ error: 'Admin access required' }, 403);
  }

  try {
    const { phone, full_name, professions, zip_codes } = await req.json();

    if (!phone) {
      return json({ error: 'phone required' }, 400);
    }

    const stripped = phone.replace(/^\+/, '');
    const email = `wa-${stripped}@app.masterleadflow.com`;

    // 1. Create auth user via admin API (proper way)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      phone: `+${stripped}`,
      phone_confirm: true,
      user_metadata: { full_name: full_name || `User ${stripped}` },
    });

    if (authErr) {
      return json({ error: `Auth create failed: ${authErr.message}` }, 500);
    }

    const userId = authData.user.id;

    // 2. Create profile
    await supabase.from('profiles').upsert({
      id: userId,
      full_name: full_name || `User ${stripped}`,
      phone: `+${stripped}`,
      whatsapp_phone: `+${stripped}`,
      role: 'contractor',
      email,
    });

    // 3. Create contractor
    await supabase.from('contractors').upsert({
      user_id: userId,
      professions: professions || ['locksmith'],
      zip_codes: zip_codes || ['33101', '33102', '33109'],
      onboarding_step: 'registered',
      working_days: [0, 1, 2, 3, 4, 5],
    });

    // 4. Create trial subscription
    const { data: plan } = await supabase
      .from('plans')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (plan) {
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        plan_id: plan.id,
        status: 'trialing',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // 5. Generate magic login token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('magic_login_tokens')
      .insert({
        user_id: userId,
        redirect_path: '/complete-account',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select('token')
      .single();

    if (tokenErr) {
      return json({ error: `Token create failed: ${tokenErr.message}`, user_id: userId }, 500);
    }

    const link = `https://app.masterleadflow.com/auto-login?token=${tokenRow.token}`;

    return json({
      user_id: userId,
      email,
      token: tokenRow.token,
      link,
      message: 'User created successfully via admin API',
    });
  } catch (err) {
    console.error('[create-test-user]', err);
    return json({ error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

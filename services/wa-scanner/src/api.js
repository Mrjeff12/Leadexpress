const express = require('express')
const { supabase, log } = require('./utils')

const PORT = process.env.API_PORT || 4000
const HEALTH_TIMEOUT_MS = 90 * 1000 // 90s = considered dead

const app = express()
app.use(express.json())

// ─── GET /health — All accounts status ───────────────────
app.get('/health', async (req, res) => {
  try {
    const { data: accounts } = await supabase
      .from('scanner_accounts')
      .select('account_id, phone_number, status, groups_joined, joins_today, last_health_at, last_error')
      .order('account_id')

    const now = Date.now()
    const enriched = (accounts || []).map(a => ({
      ...a,
      is_alive: a.last_health_at
        ? (now - new Date(a.last_health_at).getTime()) < HEALTH_TIMEOUT_MS
        : false,
    }))

    const active = enriched.filter(a => a.is_alive).length
    const total = enriched.length

    res.json({
      status: active > 0 ? 'operational' : 'degraded',
      active_accounts: active,
      total_accounts: total,
      accounts: enriched,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /accounts/:id/groups — Groups for an account ────
app.get('/accounts/:accountId/groups', async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('scanner_accounts')
      .select('id')
      .eq('account_id', req.params.accountId)
      .single()

    if (!account) return res.status(404).json({ error: 'Account not found' })

    const { data: groups } = await supabase
      .from('scanner_account_groups')
      .select('group_wa_id, role, joined_at')
      .eq('account_id', account.id)
      .order('joined_at', { ascending: false })

    res.json(groups || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── POST /accounts — Register a new account ────────────
app.post('/accounts', async (req, res) => {
  try {
    const { account_id, phone_number, proxy_url } = req.body
    if (!account_id || !phone_number) {
      return res.status(400).json({ error: 'account_id and phone_number required' })
    }

    const { data, error } = await supabase
      .from('scanner_accounts')
      .upsert({
        account_id,
        phone_number,
        proxy_url: proxy_url || null,
        status: 'disconnected',
      }, { onConflict: 'account_id' })
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Failover check (runs every 60s) ────────────────────
async function checkFailovers() {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min ago

    // Find primary assignments where account is dead
    const { data: deadPrimaries } = await supabase
      .from('scanner_account_groups')
      .select(`
        id, group_wa_id, account_id,
        scanner_accounts!inner(account_id, status, last_health_at)
      `)
      .eq('role', 'primary')
      .or(`status.eq.banned,status.eq.disconnected,last_health_at.lt.${cutoff}`, {
        referencedTable: 'scanner_accounts',
      })

    if (!deadPrimaries || deadPrimaries.length === 0) return

    for (const dead of deadPrimaries) {
      // Find a healthy backup for this group
      const { data: backup } = await supabase
        .from('scanner_account_groups')
        .select(`
          id, account_id,
          scanner_accounts!inner(account_id, status, last_health_at)
        `)
        .eq('group_wa_id', dead.group_wa_id)
        .eq('role', 'backup')
        .eq('scanner_accounts.status', 'active')
        .gt('scanner_accounts.last_health_at', cutoff)
        .limit(1)
        .single()

      if (backup) {
        // Demote dead primary → backup
        await supabase
          .from('scanner_account_groups')
          .update({ role: 'backup' })
          .eq('id', dead.id)

        // Promote backup → primary
        await supabase
          .from('scanner_account_groups')
          .update({ role: 'primary' })
          .eq('id', backup.id)

        log('info', `Failover: ${dead.group_wa_id} — demoted ${dead.scanner_accounts.account_id}, promoted ${backup.scanner_accounts.account_id}`)
      }
    }
  } catch (err) {
    log('error', `Failover check error: ${err.message}`)
  }
}

// Run failover check every 60s
setInterval(checkFailovers, 60 * 1000)

// ─── Start ───────────────────────────────────────────────
app.listen(PORT, () => {
  log('info', `Scanner API running on port ${PORT}`)
})

/**
 * Backfill WhatsApp profile pictures for all prospects.
 * Fetches avatars from Green API for prospects that don't have one yet.
 *
 * Usage:  npx tsx src/backfill-avatars.ts
 *         npx tsx src/backfill-avatars.ts --dry-run    (preview only)
 *         npx tsx src/backfill-avatars.ts --delay 300  (custom delay ms)
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!
const GREEN_API_URL = process.env.GREEN_API_URL!
const GREEN_API_ID = process.env.GREEN_API_ID!
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const delayIdx = args.indexOf('--delay')
const DELAY_MS = delayIdx >= 0 ? parseInt(args[delayIdx + 1], 10) : 250

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function greenUrl(method: string) {
  return `${GREEN_API_URL}/waInstance${GREEN_API_ID}/${method}/${GREEN_API_TOKEN}`
}

async function fetchAvatar(waId: string): Promise<string | null> {
  try {
    const res = await fetch(greenUrl('getAvatar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: waId }),
    })
    if (!res.ok) return null
    const data = await res.json() as { urlAvatar?: string; reason?: string }
    return data.urlAvatar ?? null
  } catch {
    return null
  }
}

async function main() {
  console.log('=== WhatsApp Avatar Backfill ===')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Delay: ${DELAY_MS}ms between requests`)
  console.log()

  // Fetch all prospects without a profile pic
  const allProspects: { id: string; wa_id: string; phone: string; display_name: string | null }[] = []
  let from = 0
  const size = 500

  while (true) {
    const { data, error } = await supabase
      .from('prospects')
      .select('id, wa_id, phone, display_name')
      .is('profile_pic_url', null)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .range(from, from + size - 1)

    if (error) {
      console.error('DB error:', error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    allProspects.push(...data)
    if (data.length < size) break
    from += size
  }

  console.log(`Found ${allProspects.length} prospects without avatar`)
  if (allProspects.length === 0) {
    console.log('Nothing to do!')
    return
  }

  if (DRY_RUN) {
    console.log('Dry run — not fetching avatars. Remove --dry-run to execute.')
    return
  }

  let updated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < allProspects.length; i++) {
    const p = allProspects[i]
    const waId = p.wa_id

    if (!waId) {
      skipped++
      continue
    }

    const avatarUrl = await fetchAvatar(waId)

    if (avatarUrl) {
      const { error } = await supabase
        .from('prospects')
        .update({ profile_pic_url: avatarUrl })
        .eq('id', p.id)

      if (error) {
        console.error(`  [${i + 1}/${allProspects.length}] DB update failed for ${p.phone}: ${error.message}`)
        failed++
      } else {
        updated++
        console.log(`  [${i + 1}/${allProspects.length}] ${p.display_name || p.phone} — avatar saved`)
      }
    } else {
      skipped++
      if ((i + 1) % 100 === 0) {
        console.log(`  [${i + 1}/${allProspects.length}] progress... (${updated} saved, ${skipped} no avatar)`)
      }
    }

    // Rate limiting
    await sleep(DELAY_MS)
  }

  console.log()
  console.log('=== Done ===')
  console.log(`  Updated: ${updated}`)
  console.log(`  Skipped (no avatar): ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total time: ~${Math.round(allProspects.length * DELAY_MS / 1000 / 60)} minutes`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

/**
 * Requeue leads stuck at "parsed" status back into the matching queue.
 * Usage: npx tsx scripts/requeue-stuck-leads.ts [--date YYYY-MM-DD] [--reparse]
 *
 * --date: only requeue leads from this date (default: today)
 * --reparse: also re-run AI parsing (pushes to raw-messages queue instead)
 */
import { config as loadEnv } from 'dotenv';
loadEnv(); // load .env from CWD
import { createClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!;
const redisHost = process.env.REDIS_HOST ?? '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT ?? 6379);

const args = process.argv.slice(2);
const dateArg = args.includes('--date') ? args[args.indexOf('--date') + 1] : new Date().toISOString().slice(0, 10);
const reparse = args.includes('--reparse');

const supabase = createClient(supabaseUrl, supabaseKey);
const redis = new Redis({ host: redisHost, port: redisPort, maxRetriesPerRequest: null });

async function main() {
  const queueName = reparse ? 'raw-messages' : 'parsed-leads';
  const queue = new Queue(queueName, { connection: { host: redisHost, port: redisPort, maxRetriesPerRequest: null } });

  console.log(`Fetching stuck leads from ${dateArg}...`);

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, raw_message, profession, zip_code, city, status')
    .eq('status', 'parsed')
    .gte('created_at', `${dateArg}T00:00:00Z`)
    .lt('created_at', `${dateArg}T23:59:59Z`);

  if (error) {
    console.error('Failed to fetch leads:', error.message);
    process.exit(1);
  }

  console.log(`Found ${leads.length} stuck leads`);

  if (leads.length === 0) {
    console.log('Nothing to requeue.');
    await queue.close();
    await redis.quit();
    return;
  }

  let enqueued = 0;
  for (const lead of leads) {
    if (reparse) {
      // Re-run through AI parser
      await queue.add('reparse', {
        messageId: `reparse-${lead.id}`,
        groupId: '', // will be resolved from lead
        body: lead.raw_message,
        sender: null,
        timestamp: Date.now(),
        accountId: '',
      });
    } else {
      // Push directly to matching queue (unique jobId per run)
      await queue.add('parsed-lead', { leadId: lead.id }, {
        jobId: `rq-${Date.now()}-${lead.id.slice(0, 8)}`,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
    }
    enqueued++;
  }

  console.log(`Enqueued ${enqueued} leads to "${queueName}" queue`);
  await queue.close();
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

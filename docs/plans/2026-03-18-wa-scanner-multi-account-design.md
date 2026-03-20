# WhatsApp Multi-Account Scanner — Design Document

**Date:** 2026-03-18
**Status:** Approved
**Author:** Jeff + Claude

## Problem

Green API doesn't support joining WhatsApp groups via invite link. We need an automated system to:
1. Join groups from invite links submitted by contractors/admins
2. Listen to group messages and feed them into the existing lead pipeline
3. Provide redundancy — if one account gets banned, others keep listening

## Solution

A Docker-based multi-account WhatsApp scanner running on a dedicated VPS. Each account runs in its own container with a unique phone number and proxy. All accounts feed into the existing BullMQ pipeline (raw-messages → parser → matching → notification).

## Architecture

```
┌─────────────── VPS (Hetzner 8GB) ────────────────────┐
│                                                       │
│  scanner-api (Express, port 4000)                     │
│   - Health dashboard endpoint                         │
│   - QR code endpoint per account                      │
│   - Manual join/leave commands                        │
│   - Webhook receiver from Supabase                    │
│                                                       │
│  scan-1 (container) ──► Proxy 1                       │
│  scan-2 (container) ──► Proxy 2                       │
│  scan-3 (container) ──► Proxy 3                       │
│  ...                                                  │
│  scan-N (container) ──► Proxy N                       │
│                                                       │
│  All write to:                                        │
│   - Supabase (scan status, groups, account health)    │
│   - Redis (BullMQ raw-messages queue)                 │
│                                                       │
└───────────────────────────────────────────────────────┘
```

## File Structure

```
services/wa-scanner/
├── docker-compose.yml
├── Dockerfile
├── accounts.json
├── src/
│   ├── worker.js          # Scanner worker (one per container)
│   ├── api.js             # Scanner API server (coordinator)
│   ├── failover.js        # Primary/backup rotation logic
│   └── utils.js           # Shared: Supabase client, Redis, logging
├── .env
└── data/                  # Persistent WhatsApp sessions
    ├── account-1/
    ├── account-2/
    └── ...
```

## Database (New Tables)

### scanner_accounts
- id, phone_number, proxy_url
- status: 'active' | 'qr_needed' | 'banned' | 'disconnected'
- groups_joined (count), joins_today (resets daily)
- last_health_at, last_error
- created_at

### scanner_account_groups (junction)
- account_id, group_wa_id
- role: 'primary' | 'backup'
- joined_at

## Anti-Ban Rules

| Rule | Value | Reason |
|------|-------|--------|
| Max joins/day/account | 3 | Under detection threshold |
| Delay between joins | 60-120s (random) | Human-like behavior |
| Max groups/account | 50 | Conservative (WA limit ~256) |
| Health check interval | 30s | Fast disconnect detection |
| Banned account | auto-rotate, notify admin | Don't retry |
| New group assignment | round-robin active accounts | Load balancing |

## Join Strategy (Gradual Redundancy)

When a new group is added:
1. Day 1: Account A joins (becomes primary)
2. Day 2: Account B joins (becomes backup)
3. Day 3: Account C joins (second backup)
4. Continue until desired redundancy

NOT all accounts join at once — spread over days.

## Message Flow

```
Group message → All accounts in group receive it
  → Primary account: push to BullMQ raw-messages queue
  → Backup accounts: silently ignore
  → If primary misses heartbeat for 5 min → backup promotes to primary

BullMQ raw-messages queue (shared with Green API listener)
  → Existing parser → matching → notification
  → Zero changes to existing pipeline
```

## Dedup Strategy

1. **Primary/Backup** — only primary writes to queue (prevents 95% of dupes)
2. **wa_message_id UNIQUE** — DB rejects duplicates if two accounts accidentally both write
3. **Redis dedup in parser** — existing SHA-256 content hash dedup (2h TTL)

## Integration Points

| Component | How Scanner Connects |
|-----------|---------------------|
| Supabase | Direct client (service key) — read pending scans, write status |
| Redis/BullMQ | Connect to existing Redis — push to raw-messages queue |
| Dashboard | New admin page for account monitoring (phase 2) |
| Existing pipeline | Zero changes — scanner uses same queue format |

## Cost Estimate (20 accounts)

| Item | Monthly Cost |
|------|-------------|
| VPS (8GB Hetzner) | $20 |
| 20 phone numbers (Twilio) | $20 |
| 20 residential proxies | $60-100 |
| **Total** | **~$100-140/month** |

## Rollout Plan

- Week 1: Build scanner, test with 1 account
- Week 2: Add 2-3 accounts, verify redundancy
- Month 2: Scale to 10 accounts
- Month 3: Full 20 accounts

## Dashboard Integration (Phase 2)

Admin page showing:
- Account table: phone, status, groups joined, joins today
- QR button per account for re-authentication
- Health indicators: last heartbeat, uptime
- Add/remove account controls

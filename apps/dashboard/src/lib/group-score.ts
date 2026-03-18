export interface GroupScoreInput {
  leadYield: number       // leads_created / messages_received (0-1)
  sellerRatio: number     // known_sellers / total_members (0-1)
  messages7d: number      // messages received in last 7 days
  hoursSinceLastLead: number // hours since most recent lead
}

export interface GroupScoreResult {
  score: number           // 0-100
  color: 'green' | 'yellow' | 'red'
  components: {
    leadYield: number
    sellerPressure: number
    activity: number
    freshness: number
  }
}

export function computeGroupScore(input: GroupScoreInput): GroupScoreResult {
  const leadYieldNorm = Math.min(input.leadYield / 0.20, 1.0) * 100
  const sellerPressureInv = (1 - input.sellerRatio) * 100
  const activityNorm = Math.min(input.messages7d / 50, 1.0) * 100
  const freshnessNorm = Math.max(0, 100 - input.hoursSinceLastLead * 2)

  const score = Math.round(
    leadYieldNorm * 0.40 +
    sellerPressureInv * 0.25 +
    activityNorm * 0.20 +
    freshnessNorm * 0.15
  )

  const color = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red'

  return {
    score,
    color,
    components: {
      leadYield: Math.round(leadYieldNorm),
      sellerPressure: Math.round(sellerPressureInv),
      activity: Math.round(activityNorm),
      freshness: Math.round(freshnessNorm),
    },
  }
}

export function getScoreColorClass(color: GroupScoreResult['color']): string {
  switch (color) {
    case 'green': return 'bg-emerald-100 text-emerald-700'
    case 'yellow': return 'bg-amber-100 text-amber-700'
    case 'red': return 'bg-red-100 text-red-700'
  }
}

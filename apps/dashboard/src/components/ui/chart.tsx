import React from 'react'

export type ChartConfig = Record<string, { label: string; color: string }>

export function ChartContainer({ children }: { children: React.ReactNode; config: ChartConfig }) {
  return <div className="w-full">{children}</div>
}

export function ChartTooltip(props: { content: React.ReactNode }) {
  // passthrough wrapper (recharts Tooltip is used directly where needed)
  return <>{props.content}</>
}

export function ChartTooltipContent({ indicator = 'line' as 'line' | 'dot' }) {
  // placeholder; real tooltip is provided by recharts Tooltip
  return <div data-indicator={indicator} />
}

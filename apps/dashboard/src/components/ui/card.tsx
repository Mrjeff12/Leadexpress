import React from 'react'

type PropsDiv = React.HTMLAttributes<HTMLDivElement>

export function Card({ className = '', ...rest }: PropsDiv) {
  return <div className={[ 'rounded-2xl bg-white/70 border border-white/60', className ].join(' ')} {...rest} />
}

export function CardHeader({ className = '', ...rest }: PropsDiv) {
  return <div className={[ 'px-4 pt-4 pb-2 border-b border-white/60', className ].join(' ')} {...rest} />
}

export function CardTitle({ className = '', ...rest }: PropsDiv) {
  return <div className={[ 'text-base font-medium text-zinc-900', className ].join(' ')} {...rest} />
}

export function CardDescription({ className = '', ...rest }: PropsDiv) {
  return <div className={[ 'text-xs text-zinc-600 mt-1', className ].join(' ')} {...rest} />
}

export function CardContent({ className = '', ...rest }: PropsDiv) {
  return <div className={[ 'p-4', className ].join(' ')} {...rest} />
}

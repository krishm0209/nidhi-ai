import { type HTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({ padding = 'md', className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl border border-zinc-100 shadow-sm',
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  subPositive?: boolean
  icon?: React.ReactNode
  accent?: string
}

export function StatCard({ label, value, sub, subPositive, icon, accent = 'bg-zinc-100 text-zinc-500' }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider truncate">{label}</p>
          <p className="mt-1.5 text-xl font-bold text-zinc-900 leading-tight truncate">{value}</p>
          {sub && (
            <p
              className={clsx(
                'mt-1 text-xs font-medium',
                subPositive === true && 'text-emerald-600',
                subPositive === false && 'text-red-500',
                subPositive === undefined && 'text-zinc-400'
              )}
            >
              {sub}
            </p>
          )}
        </div>
        {icon && (
          <div className={clsx('rounded-xl p-2 shrink-0', accent)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

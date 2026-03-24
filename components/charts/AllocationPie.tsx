'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export interface AllocationSlice {
  name: string
  value: number
  color: string
  pct: number
}

const fmt = (v: number) =>
  '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 })

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: AllocationSlice }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <div className="font-medium text-zinc-900">{d.name}</div>
      <div className="text-zinc-500">{fmt(d.value)} · {d.pct.toFixed(1)}%</div>
    </div>
  )
}

export function AllocationPie({ data, size = 'md' }: { data: AllocationSlice[]; size?: 'sm' | 'md' }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const h = size === 'sm' ? 160 : 200
  const inner = size === 'sm' ? 45 : 58
  const outer = size === 'sm' ? 68 : 85

  return (
    <div className="flex items-center gap-6">
      <div style={{ height: h, width: h }} className="relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={inner}
              outerRadius={outer}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-zinc-500">Total</span>
          <span className="text-sm font-semibold text-zinc-900">{fmt(total)}</span>
        </div>
      </div>

      <div className="space-y-2 min-w-0">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-zinc-600 truncate">{d.name}</span>
            <span className="text-xs font-medium text-zinc-900 ml-auto pl-3">{d.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

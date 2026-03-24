export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-zinc-200" />
        ))}
      </div>
      {/* Main content block */}
      <div className="h-64 rounded-xl bg-zinc-200" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 rounded-xl bg-zinc-200" />
        <div className="h-48 rounded-xl bg-zinc-200" />
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse max-w-4xl">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-zinc-200" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-zinc-200" />
      <div className="h-48 rounded-xl bg-zinc-200" />
    </div>
  )
}

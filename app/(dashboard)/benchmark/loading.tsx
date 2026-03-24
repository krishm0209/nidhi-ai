export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-zinc-200" />
      <div className="h-36 rounded-xl bg-zinc-200" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-zinc-200" />
        ))}
      </div>
    </div>
  )
}

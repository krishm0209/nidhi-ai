export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-zinc-200" />
      <div className="h-40 rounded-xl bg-zinc-200" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-zinc-200" />
        ))}
      </div>
    </div>
  )
}

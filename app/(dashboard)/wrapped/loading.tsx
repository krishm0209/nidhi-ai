export default function Loading() {
  return (
    <div className="max-w-lg mx-auto space-y-4 animate-pulse">
      <div className="h-56 rounded-2xl bg-zinc-300" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-36 rounded-2xl bg-zinc-200" />
        <div className="h-36 rounded-2xl bg-zinc-200" />
      </div>
      <div className="h-36 rounded-2xl bg-zinc-200" />
      <div className="h-36 rounded-2xl bg-zinc-200" />
    </div>
  )
}

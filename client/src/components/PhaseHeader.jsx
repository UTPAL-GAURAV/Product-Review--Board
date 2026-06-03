export default function PhaseHeader({ phase, label }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="h-px flex-1 bg-slate-700" />
      <span className="text-xs font-bold tracking-widest text-slate-400 uppercase whitespace-nowrap">
        {label}
      </span>
      <div className="h-px flex-1 bg-slate-700" />
    </div>
  )
}

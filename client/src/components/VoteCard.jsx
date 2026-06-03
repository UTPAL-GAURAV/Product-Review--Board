export default function VoteCard({ vote }) {
  const isYes = vote.vote === 'yes'
  const border = isYes ? 'border-emerald-700' : 'border-red-800'
  const bg = isYes ? 'bg-emerald-950' : 'bg-red-950'
  const badge = isYes
    ? 'bg-emerald-500 text-white'
    : 'bg-red-600 text-white'

  return (
    <div className={`rounded-xl border p-4 ${bg} ${border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{vote.emoji}</span>
          <span className="font-semibold text-sm text-white">{vote.name}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${badge}`}>
          {vote.vote}
        </span>
      </div>
      {vote.confidence != null && (
        <div className="mb-2">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Confidence</span>
            <span>{vote.confidence}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${isYes ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${vote.confidence}%` }}
            />
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{vote.reasoning}</p>
    </div>
  )
}

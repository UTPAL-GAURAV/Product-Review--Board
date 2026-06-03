import VoteCard from './VoteCard'

export default function VotingPanel({ votes }) {
  const yes = votes.filter(v => v.vote === 'yes').length
  const no = votes.filter(v => v.vote === 'no').length
  const total = yes + no
  const approval = total > 0 ? Math.round((yes / total) * 100) : 0

  return (
    <div className="mt-6 p-4 border-t border-slate-700">
      <h2 className="text-lg font-bold text-white mb-1">Vote Results</h2>
      {total > 0 && (
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="text-emerald-400 font-semibold">✅ {yes} YES</span>
          <span className="text-red-400 font-semibold">❌ {no} NO</span>
          <span className="text-slate-400">— {approval}% approval</span>
        </div>
      )}
      {votes.length === 0 && (
        <p className="text-slate-500 text-sm mb-4">Votes coming in…</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {votes.map((v, i) => (
          <VoteCard key={i} vote={v} />
        ))}
      </div>
    </div>
  )
}

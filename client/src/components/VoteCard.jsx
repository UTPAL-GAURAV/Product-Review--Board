import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function VoteCard({ vote }) {
  const [expanded, setExpanded] = useState(false)
  const isYes = vote.vote === 'yes'
  const border = isYes ? 'border-emerald-700' : 'border-red-800'
  const bg = isYes ? 'bg-emerald-950' : 'bg-red-950'
  const badge = isYes ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white'

  return (
    <div className={`rounded-xl border p-4 ${bg} ${border} cursor-pointer`} onClick={() => setExpanded(e => !e)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{vote.emoji}</span>
          <span className="font-semibold text-sm text-white">{vote.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${badge}`}>
            {vote.vote}
          </span>
          <span className="text-slate-500 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
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
      {expanded ? (
        <div className="markdown-content text-xs text-slate-300 leading-relaxed mt-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{vote.reasoning}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{vote.reasoning}</p>
      )}
    </div>
  )
}

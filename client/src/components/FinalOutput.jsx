import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function FinalOutput({ content, voteResults }) {
  if (!content) return null

  const yes = voteResults?.yes ?? 0
  const no = voteResults?.no ?? 0
  const total = yes + no
  const approval = total > 0 ? Math.round((yes / total) * 100) : 0

  return (
    <div className="mt-4 rounded-xl border border-indigo-700 bg-indigo-950 p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">📋</span>
        <div>
          <h2 className="text-white font-bold text-base">Final Board Output</h2>
          {total > 0 && (
            <p className="text-indigo-300 text-xs">{yes} YES · {no} NO · {approval}% approval</p>
          )}
        </div>
      </div>
      <div className="markdown-content text-sm text-indigo-100 leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  )
}

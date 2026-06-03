import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createPlan } from '../lib/api'

export default function FinalOutput({ sessionId, content, voteResults, plan, planGenerating }) {
  if (!content && !plan && !planGenerating) return null

  const yes = voteResults?.yes ?? 0
  const no = voteResults?.no ?? 0
  const total = yes + no
  const approval = total > 0 ? Math.round((yes / total) * 100) : 0
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(plan)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-4 space-y-4">
      {content && (
      <div className="rounded-xl border border-indigo-700 bg-indigo-950 p-5">
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
      )}

      {/* Create Plan button */}
      {!plan && !planGenerating && (
        <div className="flex justify-center py-2">
          <button
            onClick={() => createPlan(sessionId)}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 shadow-lg"
          >
            🚀 Create Product Plan
          </button>
        </div>
      )}

      {planGenerating && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-violet-300 text-sm">
            <span className="animate-pulse">⚙️</span>
            <span>PM is writing the product plan…</span>
          </div>
        </div>
      )}

      {plan && (
        <div className="rounded-xl border border-violet-700 bg-violet-950 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚀</span>
              <h2 className="text-white font-bold text-base">Product Plan</h2>
            </div>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs bg-violet-700 hover:bg-violet-600 text-white rounded-lg transition-colors"
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>
          <div className="markdown-content text-sm text-violet-100 leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AGENT_META, PHASE_LABELS } from '../lib/agents'

export default function AgentCard({ message }) {
  const meta = AGENT_META[message.agentKey] || {
    name: message.name,
    emoji: message.emoji,
    color: 'bg-slate-800 border-slate-600 text-slate-100',
  }
  const phaseLabel = PHASE_LABELS[message.phase]

  return (
    <div className={`rounded-xl border p-4 ${meta.color} shadow-lg`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.emoji}</span>
          <span className="font-semibold text-sm tracking-wide">{meta.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs opacity-60">
          {phaseLabel && <span className="px-2 py-0.5 rounded-full bg-white/10">{phaseLabel}</span>}
        </div>
      </div>
      <div className="markdown-content text-sm leading-relaxed opacity-90">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </div>
  )
}

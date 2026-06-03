import { AGENT_META } from '../lib/agents'

export default function ThinkingCard({ agent }) {
  const meta = AGENT_META[agent.agentKey] || { name: agent.name, emoji: agent.emoji, color: 'bg-slate-800 border-slate-600 text-slate-100' }

  return (
    <div className={`rounded-xl border p-4 ${meta.color} shadow-lg opacity-70`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{meta.emoji}</span>
        <span className="font-semibold text-sm tracking-wide">{meta.name}</span>
        <span className="flex gap-1 ml-1">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  )
}

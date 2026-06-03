import { useState, useEffect } from 'react'
import { AGENT_META } from '../lib/agents'

export default function ThinkingCard({ agent }) {
  const meta = AGENT_META[agent.agentKey] || { name: agent.name, emoji: agent.emoji, color: 'bg-slate-800 border-slate-600 text-slate-100' }
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    setSeconds(0)
    const interval = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [agent.agentKey])

  return (
    <div className={`rounded-xl border p-4 ${meta.color} shadow-lg opacity-70`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.emoji}</span>
          <span className="font-semibold text-sm tracking-wide">{meta.name}</span>
          <span className="flex gap-1 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
          </span>
        </div>
        <span className="text-xs opacity-50 tabular-nums">{seconds}s</span>
      </div>
    </div>
  )
}

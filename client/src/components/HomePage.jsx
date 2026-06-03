import { useEffect, useState } from 'react'
import { listSessions } from '../lib/api'

const STATUS_BADGES = {
  reviewing:        'bg-blue-900 text-blue-300',
  debating:         'bg-orange-900 text-orange-300',
  awaiting_founder: 'bg-yellow-900 text-yellow-300',
  voting:           'bg-purple-900 text-purple-300',
  completed:        'bg-emerald-900 text-emerald-300',
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function HomePage({ onNewSession, onSelectSession }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="text-4xl mb-3">🏛</div>
          <h1 className="text-3xl font-bold text-white mb-2">Product Review Board</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            8 AI agents — PM, Customer, Growth, Architect, Investor, Domain Expert, Competitor, and Red Team — will tear your idea apart and vote.
          </p>
          <div className="mt-2 flex justify-center gap-2 text-lg">
            <span title="PM">💼</span>
            <span title="Customer">🎒</span>
            <span title="Marketing">📈</span>
            <span title="Architect">🏗</span>
            <span title="Investor">💰</span>
            <span title="Domain Expert">🎓</span>
            <span title="Competitor">⚔</span>
            <span title="Red Team">🔴</span>
            <span title="Market Analyst">🔍</span>
          </div>
        </div>

        <button
          onClick={onNewSession}
          className="w-full py-4 mb-8 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
        >
          <span>+</span> New Review Session
        </button>

        {loading && (
          <p className="text-slate-500 text-sm text-center">Loading sessions…</p>
        )}

        {!loading && sessions.length === 0 && (
          <p className="text-slate-600 text-sm text-center">No sessions yet. Create your first one above.</p>
        )}

        <div className="flex flex-col gap-3">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session)}
              className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{session.product_name}</p>
                  <p className="text-slate-500 text-xs mt-1 line-clamp-2">{session.product_description}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGES[session.status] || 'bg-slate-800 text-slate-400'}`}>
                    {session.status.replace('_', ' ')}
                  </span>
                  <span className="text-slate-600 text-xs">{formatDate(session.created_at)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { proceedToVote } from '../lib/api'

export default function ProceedToVoteButton({ sessionId }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleClick() {
    if (loading || done) return
    setLoading(true)
    try {
      await proceedToVote(sessionId)
      setDone(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center py-4 border-t border-slate-700 bg-slate-900">
      <button
        onClick={handleClick}
        disabled={loading || done}
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
      >
        {done ? '✓ Voting in progress…' : loading ? 'Starting vote…' : '🗳 Proceed to Vote'}
      </button>
    </div>
  )
}

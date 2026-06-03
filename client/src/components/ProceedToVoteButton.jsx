import { useState } from 'react'
import { proceedToVote, improveIdea } from '../lib/api'

export default function ProceedToVoteButton({ sessionId }) {
  const [voteLoading, setVoteLoading] = useState(false)
  const [voteDone, setVoteDone] = useState(false)
  const [improveLoading, setImproveLoading] = useState(false)
  const [improveDone, setImproveDone] = useState(false)

  async function handleVote() {
    if (voteLoading || voteDone) return
    setVoteLoading(true)
    try {
      await proceedToVote(sessionId)
      setVoteDone(true)
    } catch (err) {
      console.error(err)
    } finally {
      setVoteLoading(false)
    }
  }

  async function handleImprove() {
    if (improveLoading || improveDone) return
    setImproveLoading(true)
    try {
      await improveIdea(sessionId)
      setImproveDone(true)
    } catch (err) {
      console.error(err)
    } finally {
      setImproveLoading(false)
    }
  }

  return (
    <div className="flex justify-center gap-3 py-4 border-t border-slate-700 bg-slate-900">
      <button
        onClick={handleImprove}
        disabled={improveLoading || improveDone || voteDone}
        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
      >
        {improveDone ? '✓ PM is revising…' : improveLoading ? 'Improving…' : '✨ Improve Idea'}
      </button>
      <button
        onClick={handleVote}
        disabled={voteLoading || voteDone}
        className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
      >
        {voteDone ? '✓ Voting in progress…' : voteLoading ? 'Starting vote…' : '🗳 Proceed to Vote'}
      </button>
    </div>
  )
}

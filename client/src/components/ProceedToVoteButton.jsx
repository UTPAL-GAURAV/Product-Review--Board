import { useState, useEffect } from 'react'
import { proceedToVote, improveIdea } from '../lib/api'

function useTimer(running) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!running) { setSeconds(0); return }
    const interval = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [running])
  return seconds
}

export default function ProceedToVoteButton({ sessionId }) {
  const [voteLoading, setVoteLoading] = useState(false)
  const [voteDone, setVoteDone] = useState(false)
  const [improveLoading, setImproveLoading] = useState(false)
  const [improveDone, setImproveDone] = useState(false)
  const [note, setNote] = useState('')

  const improveSeconds = useTimer(improveDone)
  const voteSeconds = useTimer(voteDone)

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
      await improveIdea(sessionId, note.trim())
      setImproveDone(true)
      setNote('')
    } catch (err) {
      console.error(err)
    } finally {
      setImproveLoading(false)
    }
  }

  return (
    <div className="border-t border-slate-700 bg-slate-900 px-4 py-3">
      <div className="max-w-3xl mx-auto flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleImprove()}
            disabled={improveLoading || improveDone || voteDone}
            placeholder="Optional note for PM… (leave blank to let PM decide)"
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
          />
          <button
            onClick={handleImprove}
            disabled={improveLoading || improveDone || voteDone}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors whitespace-nowrap flex items-center gap-2"
          >
            {improveDone
              ? `✓ PM is revising… ${improveSeconds}s`
              : improveLoading ? 'Improving…' : '✨ Improve Idea'}
          </button>
          <button
            onClick={handleVote}
            disabled={voteLoading || voteDone}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors whitespace-nowrap flex items-center gap-2"
          >
            {voteDone
              ? `✓ Voting in progress… ${voteSeconds}s`
              : voteLoading ? 'Starting vote…' : '🗳 Proceed to Vote'}
          </button>
        </div>
      </div>
    </div>
  )
}

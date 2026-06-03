import { useEffect, useRef, useState } from 'react'
import { useSSEStream } from '../hooks/useSSEStream'
import { startSession, stopSession } from '../lib/api'
import { STATUS_LABELS } from '../lib/agents'
import AgentCard from './AgentCard'
import ThinkingCard from './ThinkingCard'
import PhaseHeader from './PhaseHeader'
import FounderInputBox from './FounderInputBox'
import ProceedToVoteButton from './ProceedToVoteButton'
import VotingPanel from './VotingPanel'
import FinalOutput from './FinalOutput'

const STATUS_COLORS = {
  reviewing:        'bg-blue-600',
  debating:         'bg-orange-500',
  awaiting_founder: 'bg-yellow-500',
  voting:           'bg-purple-600',
  completed:        'bg-emerald-600',
}

export default function BoardRoom({ session, onBack }) {
  const { messages, phases, votes, status, finalOutput, thinkingAgent, plan, planGenerating, addFounderMessage } = useSSEStream(
    session.id,
    session.status
  )
  const bottomRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const startedRef = useRef(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // Kick off Phase 1 automatically on first render if still in 'reviewing'
  useEffect(() => {
    if (startedRef.current) return
    if (session.status === 'reviewing') {
      startedRef.current = true
      startSession(session.id).catch(console.error)
    }
  }, [session.id, session.status])

  // Show scroll button when user is not near the bottom
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    function onScroll() {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      setShowScrollBtn(distFromBottom > 200)
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const canFounderInput = status === 'awaiting_founder' && !thinkingAgent
  const showVoteButton = status === 'awaiting_founder' && !thinkingAgent
  const showVoting = status === 'voting' || status === 'completed'
  const boardBusy = status === 'reviewing' || status === 'debating' || status === 'voting' || !!thinkingAgent

  // Build a flat ordered list of items to render
  const renderedPhases = new Set()
  const items = []
  for (const msg of messages) {
    if (!renderedPhases.has(msg.phase)) {
      const phaseInfo = phases.find(p => p.phase === msg.phase)
      if (phaseInfo) {
        items.push({ type: 'phase', phase: msg.phase, label: phaseInfo.label })
        renderedPhases.add(msg.phase)
      }
    }
    items.push({ type: 'message', message: msg })
  }

  function handleFounderSent(content) {
    addFounderMessage(content)
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            ← Back
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <div>
            <h1 className="text-white font-bold text-sm">{session.product_name}</h1>
            <p className="text-slate-500 text-xs truncate max-w-xs">{session.product_description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] || 'bg-slate-600'} ${boardBusy ? 'animate-pulse' : ''}`} />
          <span className="text-xs text-slate-400">{STATUS_LABELS[status] || status}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 max-w-3xl mx-auto w-full">
        {items.length === 0 && (
          <div className="text-center text-slate-500 text-sm mt-20">
            <div className="text-3xl mb-3 animate-pulse">⚙️</div>
            <p>Convening the board…</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {items.map((item, i) => {
            if (item.type === 'phase') {
              return <PhaseHeader key={`ph-${item.phase}`} phase={item.phase} label={item.label} />
            }
            return <AgentCard key={item.message.id || i} message={item.message} />
          })}

          {thinkingAgent && <ThinkingCard agent={thinkingAgent} />}
        </div>

        {showVoting && (
          <VotingPanel votes={votes} />
        )}

        {finalOutput && (
          <FinalOutput
            sessionId={session.id}
            content={finalOutput}
            voteResults={{ yes: votes.filter(v => v.vote === 'yes').length, no: votes.filter(v => v.vote === 'no').length }}
            plan={plan}
            planGenerating={planGenerating}
          />
        )}

        {/* Show Create Plan button even without final summary, for completed sessions */}
        {status === 'completed' && !finalOutput && !plan && !planGenerating && (
          <div className="flex justify-center py-6">
            <button
              onClick={() => { import('../lib/api').then(m => m.createPlan(session.id)) }}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 shadow-lg"
            >
              🚀 Create Product Plan
            </button>
          </div>
        )}
        {status === 'completed' && !finalOutput && planGenerating && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2 text-violet-300 text-sm">
              <span className="animate-pulse">⚙️</span>
              <span>PM is writing the product plan…</span>
            </div>
          </div>
        )}
        {status === 'completed' && !finalOutput && plan && (
          <FinalOutput
            sessionId={session.id}
            content={null}
            voteResults={{ yes: votes.filter(v => v.vote === 'yes').length, no: votes.filter(v => v.vote === 'no').length }}
            plan={plan}
            planGenerating={false}
          />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Floating buttons */}
      {boardBusy && (
        <button
          onClick={() => stopSession(session.id).catch(console.error)}
          className="fixed bottom-24 left-6 z-50 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold px-3 py-2 rounded-full shadow-lg transition-colors flex items-center gap-1"
        >
          ■ Stop
        </button>
      )}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-6 z-50 bg-slate-700 hover:bg-slate-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
          title="Scroll to bottom"
        >
          ↓
        </button>
      )}

      {/* Bottom actions */}
      {showVoteButton && (
        <ProceedToVoteButton key={`vote-btn-${messages.length}`} sessionId={session.id} />
      )}
      {status !== 'completed' && (
        <FounderInputBox
          sessionId={session.id}
          disabled={!canFounderInput}
          onSent={handleFounderSent}
        />
      )}
    </div>
  )
}

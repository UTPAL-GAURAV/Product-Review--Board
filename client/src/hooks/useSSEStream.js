import { useEffect, useReducer, useRef } from 'react'
import { getMessages, getVotes, getPlan } from '../lib/api'
import { AGENT_META } from '../lib/agents'

const initialState = {
  messages: [],
  phases: [],
  votes: [],
  status: 'reviewing',
  finalOutput: null,
  thinkingAgent: null, // { agentKey, name, emoji }
  plan: null,
  planGenerating: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'PHASE_START':
      if (state.phases.find(p => p.phase === action.phase)) return state
      return { ...state, phases: [...state.phases, { phase: action.phase, label: action.label }] }
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] }
    case 'ADD_VOTE':
      return { ...state, votes: [...state.votes, action.vote] }
    case 'SET_STATUS':
      return { ...state, status: action.status }
    case 'SET_FINAL_OUTPUT':
      return { ...state, finalOutput: action.content }
    case 'SET_THINKING':
      return { ...state, thinkingAgent: action.agent }
    case 'SET_PLAN':
      return { ...state, plan: action.content, planGenerating: false }
    case 'SET_PLAN_GENERATING':
      return { ...state, planGenerating: action.value }
    case 'BULK_LOAD': {
      // Reconstruct phases from messages
      const phases = []
      const seen = new Set()
      for (const m of action.messages) {
        if (!seen.has(m.phase)) {
          seen.add(m.phase)
          phases.push({ phase: m.phase, label: phaseLabelFromNumber(m.phase) })
        }
      }
      return {
        ...state,
        messages: action.messages,
        votes: action.votes,
        phases,
        status: action.status,
      }
    }
    default:
      return state
  }
}

function phaseLabelFromNumber(phase) {
  const labels = {
    1: 'PHASE 1: INITIAL REVIEW — Independent Analysis',
    2: 'PHASE 2: DEBATE — Challenging Assumptions',
    3: 'PHASE 3: PRODUCT REVISION',
    35: 'PHASE 3.5: IDEA IMPROVEMENT — PM Synthesis',
    4: 'PHASE 4: FOUNDER RESPONSE',
    5: 'PHASE 5: FINAL REVIEW',
    6: 'PHASE 6: VOTING',
  }
  return labels[phase] || `Phase ${phase}`
}

export function useSSEStream(sessionId, initialStatus = 'reviewing') {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    status: initialStatus,
  })
  const esRef = useRef(null)

  // Load historical messages for already-started sessions
  useEffect(() => {
    if (!sessionId || initialStatus === 'reviewing') return

    async function loadHistory() {
      try {
        const [msgs, votes, planData] = await Promise.all([
          getMessages(sessionId),
          getVotes(sessionId),
          getPlan(sessionId).catch(() => ({ plan: null })),
        ])

        const messages = msgs.map(m => ({
          id: m.id,
          agentKey: m.agent_key,
          name: m.agent_name || (m.role === 'user' ? 'Founder' : ''),
          emoji: m.agent_key ? (AGENT_META[m.agent_key]?.emoji || '') : '🧑',
          content: m.content,
          phase: m.phase,
          timestamp: m.created_at,
          isFounder: m.role === 'user',
        }))

        const formattedVotes = votes.map(v => ({
          agentKey: v.agent_key,
          name: v.agent_name,
          emoji: AGENT_META[v.agent_key]?.emoji || '',
          vote: v.vote,
          confidence: v.confidence,
          reasoning: v.reasoning,
        }))

        dispatch({ type: 'BULK_LOAD', messages, votes: formattedVotes, status: initialStatus })
        if (planData?.plan) dispatch({ type: 'SET_PLAN', content: planData.plan })

        // Load final output from session
        const { getSession } = await import('../lib/api')
        const sess = await getSession(sessionId).catch(() => null)
        if (sess?.final_output) dispatch({ type: 'SET_FINAL_OUTPUT', content: sess.final_output })
      } catch (err) {
        console.error('Failed to load history:', err)
      }
    }

    loadHistory()
  }, [sessionId, initialStatus])

  useEffect(() => {
    if (!sessionId) return

    function connect() {
      const es = new EventSource(`/api/sessions/${sessionId}/stream`)
      esRef.current = es

      es.onmessage = (e) => {
        if (!e.data || e.data.trim() === '') return
        let event
        try { event = JSON.parse(e.data) } catch { return }

        if (event.type === 'phase_start') {
          dispatch({ type: 'PHASE_START', phase: event.phase, label: event.label })
        } else if (event.type === 'thinking_start') {
          dispatch({ type: 'SET_THINKING', agent: { agentKey: event.agentKey, name: event.name, emoji: event.emoji } })
        } else if (event.type === 'thinking_end') {
          dispatch({ type: 'SET_THINKING', agent: null })        } else if (event.type === 'agent_message') {
          dispatch({ type: 'SET_THINKING', agent: null })
          dispatch({
            type: 'ADD_MESSAGE',
            message: {
              id: `${Date.now()}-${Math.random()}`,
              agentKey: event.agentKey,
              name: event.name,
              emoji: event.emoji,
              content: event.content,
              phase: event.phase,
              timestamp: new Date().toISOString(),
              isFounder: false,
            },
          })
        } else if (event.type === 'vote') {
          dispatch({
            type: 'ADD_VOTE',
            vote: {
              agentKey: event.agentKey,
              name: event.name,
              emoji: event.emoji,
              vote: event.vote,
              confidence: event.confidence,
              reasoning: event.reasoning,
            },
          })
        } else if (event.type === 'status_change') {
          dispatch({ type: 'SET_STATUS', status: event.status })
        } else if (event.type === 'final_output') {
          dispatch({ type: 'SET_FINAL_OUTPUT', content: event.content })
        } else if (event.type === 'plan_generating') {
          dispatch({ type: 'SET_PLAN_GENERATING', value: true })
        } else if (event.type === 'plan_ready') {
          dispatch({ type: 'SET_PLAN', content: event.content })
        } else if (event.type === 'plan_error') {
          dispatch({ type: 'SET_PLAN_GENERATING', value: false })
        }
      }

      es.onerror = () => {
        es.close()
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => esRef.current?.close()
  }, [sessionId])

  const addFounderMessage = (content) => {
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: `founder-${Date.now()}`,
        agentKey: 'founder',
        name: 'Founder',
        emoji: '🧑',
        content,
        phase: 4,
        timestamp: new Date().toISOString(),
        isFounder: true,
      },
    })
  }

  return { ...state, addFounderMessage }
}

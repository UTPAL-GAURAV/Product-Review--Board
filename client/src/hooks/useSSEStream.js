import { useEffect, useReducer, useRef } from 'react'

const initialState = {
  messages: [],
  phases: [],   // { phase, label }
  votes: [],
  status: 'reviewing',
  finalOutput: null,
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
    case 'BULK_LOAD':
      return { ...state, messages: action.messages, phases: action.phases, status: action.status }
    default:
      return state
  }
}

export function useSSEStream(sessionId, initialStatus = 'reviewing') {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    status: initialStatus,
  })
  const esRef = useRef(null)

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
        } else if (event.type === 'agent_message') {
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

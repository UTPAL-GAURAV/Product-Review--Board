import { useState } from 'react'
import HomePage from './components/HomePage'
import NewSessionForm from './components/NewSessionForm'
import BoardRoom from './components/BoardRoom'

export default function App() {
  const [view, setView] = useState('home')
  const [activeSession, setActiveSession] = useState(null)

  if (view === 'new') {
    return (
      <NewSessionForm
        onCreated={(session) => { setActiveSession(session); setView('board') }}
        onBack={() => setView('home')}
      />
    )
  }

  if (view === 'board' && activeSession) {
    return (
      <BoardRoom
        session={activeSession}
        onBack={() => { setView('home'); setActiveSession(null) }}
      />
    )
  }

  return (
    <HomePage
      onNewSession={() => setView('new')}
      onSelectSession={(s) => { setActiveSession(s); setView('board') }}
    />
  )
}

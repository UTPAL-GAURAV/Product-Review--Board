import { useState } from 'react'
import { sendFounderInput } from '../lib/api'

export default function FounderInputBox({ sessionId, disabled, onSent }) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const text = value.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await sendFounderInput(sessionId, text)
      onSent(text)
      setValue('')
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
  }

  return (
    <div className="border-t border-slate-700 bg-slate-900 p-4">
      <div className="flex gap-3 items-end max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-slate-400 text-sm shrink-0 pb-2.5">
          <span className="text-xl">🧑</span>
          <span className="font-medium">Founder</span>
        </div>
        <textarea
          className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:border-slate-400 disabled:opacity-40"
          rows={2}
          placeholder={disabled ? 'Board is deliberating…' : 'Reply to the board, add constraints, or change direction… (⌘+Enter to send)'}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim() || sending}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

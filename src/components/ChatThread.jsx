import { useEffect, useRef, useState } from 'react'

const fmtTime = (t) =>
  new Date(t).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })

// mineSender: 'user' or 'admin' — decides which side of the thread this
// viewer's own messages render on.
export default function ChatThread({ messages, mineSender, onSend, placeholder = 'Type a message…' }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  async function send() {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await onSend(trimmed)
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat-box">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="muted" style={{ margin: 'auto', fontSize: 13 }}>
            No messages yet.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={'chat-bubble ' + (m.sender === mineSender ? 'mine' : 'theirs')}>
            {m.message}
            <div className="chat-meta">{fmtTime(m.createdAt)}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={placeholder}
          disabled={busy}
        />
        <button className="btn btn-primary" onClick={send} disabled={busy || !text.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}

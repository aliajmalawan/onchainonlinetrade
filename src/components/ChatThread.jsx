import { useEffect, useRef, useState } from 'react'

const ROOT = (import.meta.env.VITE_BACKEND_URL || '/api').replace(/\/api$/, '')
const attachmentUrl = (path) => (path ? ROOT + '/' + path.replace(/^\//, '') : null)

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const ALLOWED_ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']

const fmtTime = (t) =>
  new Date(t).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })

function dateLabel(t) {
  const d = new Date(t)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a, b) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

// Groups messages into {type:'date', label} / {type:'msg', data} so a date
// pill is inserted whenever the calendar day changes.
function withDateSeparators(messages) {
  const items = []
  let lastDay = null
  for (const m of messages) {
    const day = new Date(m.createdAt).toDateString()
    if (day !== lastDay) {
      items.push({ type: 'date', key: 'date-' + day, label: dateLabel(m.createdAt) })
      lastDay = day
    }
    items.push({ type: 'msg', key: m.id, data: m })
  }
  return items
}

const SendIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const PaperclipIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
)

const SmileIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
)

const CheckTicksIcon = () => (
  <svg viewBox="0 0 18 12" width="14" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 6l3 3 6-7" />
    <path d="M6 6l3 3 6-7" />
  </svg>
)

const FileIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const EMOJIS = ['😀', '😂', '😊', '😍', '🙏', '👍', '👌', '🔥', '🎉', '❤️', '😢', '😮', '🤔', '😅', '🙌', '💪', '✅', '⚠️']

// mineSender: 'user' or 'admin' — decides which side of the thread this
// viewer's own messages render on. theirsAvatar: small avatar node shown
// beside the other party's bubbles (support icon, or the user's initials on
// the admin side). brandBackground: shows the faint coin/candlestick
// watermark behind the thread (only on the branded customer-facing page).
export default function ChatThread({
  messages,
  mineSender,
  onSend,
  placeholder = 'Type a message…',
  theirsAvatar,
  brandBackground = false,
}) {
  const [text, setText] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const containerRef = useRef(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const prevCountRef = useRef(0)
  // Polling refreshes `messages` every few seconds even when nothing new
  // arrived, which used to yank the view back to the bottom and undo the
  // user's manual scroll-up. Only auto-scroll when a message was actually
  // added AND the user hadn't scrolled away to read history.
  const isNearBottomRef = useRef(true)

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  useEffect(() => {
    const countIncreased = messages.length > prevCountRef.current
    prevCountRef.current = messages.length
    if (countIncreased && isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages])

  function pickFile() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileError('')
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      setFileError('Only images or PDF files can be shared.')
      return
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFileError('File must be 10MB or smaller.')
      return
    }
    setPendingFile(file)
  }

  async function send() {
    const trimmed = text.trim()
    if ((!trimmed && !pendingFile) || busy) return
    setBusy(true)
    try {
      await onSend(trimmed, pendingFile)
      setText('')
      setPendingFile(null)
      setFileError('')
      isNearBottomRef.current = true
    } finally {
      setBusy(false)
    }
  }

  function insertEmoji(e) {
    setText((t) => t + e)
    setShowEmoji(false)
  }

  const items = withDateSeparators(messages)

  return (
    <div className="chat-box">
      <div className="chat-messages" ref={containerRef} onScroll={handleScroll}>
        {brandBackground && (
          <div className="chat-backdrop" aria-hidden="true">
            <div className="chat-backdrop-coin">₿</div>
            <div className="chat-backdrop-candles">
              <span style={{ height: '30%' }} />
              <span style={{ height: '58%' }} />
              <span style={{ height: '40%' }} />
              <span style={{ height: '75%' }} />
              <span style={{ height: '48%' }} />
              <span style={{ height: '64%' }} />
            </div>
          </div>
        )}
        {messages.length === 0 && (
          <div className="muted" style={{ margin: 'auto', fontSize: 13, position: 'relative', zIndex: 1 }}>
            No messages yet.
          </div>
        )}
        {items.map((item) => {
          if (item.type === 'date') {
            return (
              <div key={item.key} className="chat-date-sep">
                <span>{item.label}</span>
              </div>
            )
          }
          const m = item.data
          const mine = m.sender === mineSender
          return (
            <div key={item.key} className={'chat-msg-row' + (mine ? ' mine' : ' theirs')}>
              {!mine && <span className="chat-msg-avatar">{theirsAvatar}</span>}
              <div className={'chat-bubble ' + (mine ? 'mine' : 'theirs')}>
                {m.attachmentPath && m.attachmentType === 'image' && (
                  <a href={attachmentUrl(m.attachmentPath)} target="_blank" rel="noreferrer" className="chat-attachment-image">
                    <img src={attachmentUrl(m.attachmentPath)} alt={m.attachmentName || 'attachment'} />
                  </a>
                )}
                {m.attachmentPath && m.attachmentType === 'file' && (
                  <a href={attachmentUrl(m.attachmentPath)} target="_blank" rel="noreferrer" className="chat-attachment-file">
                    <FileIcon />
                    <span>{m.attachmentName || 'Attachment'}</span>
                  </a>
                )}
                {m.message && <div className={m.attachmentPath ? 'chat-caption' : undefined}>{m.message}</div>}
                <div className="chat-meta">
                  {fmtTime(m.createdAt)}
                  {mine && <CheckTicksIcon />}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      {(pendingFile || fileError) && (
        <div className="chat-pending-file">
          {pendingFile && (
            <>
              {pendingFile.type.startsWith('image/') ? (
                <img src={URL.createObjectURL(pendingFile)} alt="" className="chat-pending-thumb" />
              ) : (
                <span className="chat-pending-thumb chat-pending-thumb-file"><FileIcon /></span>
              )}
              <span className="chat-pending-name">{pendingFile.name}</span>
              <button type="button" className="chat-icon-btn" onClick={() => setPendingFile(null)} aria-label="Remove attachment">
                <CloseIcon />
              </button>
            </>
          )}
          {fileError && <span className="field-error" style={{ margin: 0 }}>{fileError}</span>}
        </div>
      )}
      <div className="chat-input-row">
        <div className="chat-input-pill">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="chat-icon-btn"
            onClick={pickFile}
            aria-label="Attach file"
            title="Attach an image or PDF"
          >
            <PaperclipIcon />
          </button>
          <input
            className="chat-input-field"
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
          <div className="chat-emoji-wrap">
            <button
              type="button"
              className="chat-icon-btn"
              onClick={() => setShowEmoji((v) => !v)}
              aria-label="Insert emoji"
            >
              <SmileIcon />
            </button>
            {showEmoji && (
              <div className="chat-emoji-popover">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => insertEmoji(e)}>
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          className="chat-send-btn"
          onClick={send}
          disabled={busy || (!text.trim() && !pendingFile)}
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}

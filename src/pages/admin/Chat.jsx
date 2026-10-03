import { useEffect, useMemo, useState } from 'react'
import ChatThread from '../../components/ChatThread'
import { apiAdminGetChats, apiAdminGetChat, apiAdminSendChat, apiGetUsers } from '../../lib/backend'

const POLL_MS = 5000

const AVATAR_COLORS = [
  { bg: '#CFF4EC', text: '#0F9C8F' },
  { bg: '#E3DFFB', text: '#6D5BD0' },
  { bg: '#DCEBFB', text: '#3B82C4' },
  { bg: '#FBDCE8', text: '#C4478C' },
  { bg: '#FBF0D0', text: '#B8860B' },
  { bg: '#DFF3DC', text: '#3F9142' },
]
function colorFor(name) {
  let hash = 0
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function relativeTime(at) {
  if (!at) return ''
  const diffMs = Date.now() - new Date(at).getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ${hr === 1 ? 'hour' : 'hours'} ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} ${day === 1 ? 'day' : 'days'} ago`
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

export default function Chat() {
  const [conversations, setConversations] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  function loadConversations() {
    apiAdminGetChats().then(setConversations).catch(() => {})
  }

  function loadThread(userId) {
    apiAdminGetChat(userId).then(setMessages).catch(() => {})
  }

  useEffect(() => {
    loadConversations()
    const id = setInterval(loadConversations, POLL_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    apiGetUsers().then(setAllUsers).catch(() => {})
  }, [])

  // Every non-admin user shows up here, not just the ones who've already
  // messaged support — so admin can start a conversation with anyone, not
  // only reply to existing threads.
  const conversationList = useMemo(() => {
    const withConvo = [...conversations].sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))
    const withConvoIds = new Set(conversations.map((c) => c.userId))
    const withoutConvo = allUsers
      .filter((u) => u.role !== 'admin' && !withConvoIds.has(u.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => ({
        userId: u.id, name: u.name, email: u.email,
        lastMessage: null, lastSender: null, lastAt: null,
        unreadCount: 0, online: false,
      }))
    return [...withConvo, ...withoutConvo]
  }, [conversations, allUsers])

  const visibleList = useMemo(() => {
    const q = search.trim().toLowerCase()
    return conversationList.filter((c) => {
      if (filter === 'unread' && !c.unreadCount) return false
      if (filter === 'online' && !c.online) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.lastMessage || '').toLowerCase().includes(q)
    })
  }, [conversationList, search, filter])

  useEffect(() => {
    if (!selected) {
      setMessages([])
      return
    }
    loadThread(selected)
    const id = setInterval(() => loadThread(selected), POLL_MS)
    return () => clearInterval(id)
  }, [selected])

  async function send(text, file) {
    await apiAdminSendChat(selected, text, file)
    loadThread(selected)
    loadConversations()
  }

  const active = conversationList.find((c) => c.userId === selected)

  const initials = (name) =>
    (name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'

  return (
    <div>
      <div className="page-head chat-page-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Live Chat</h1>
        </div>
        <div className="page-head-illustration" aria-hidden="true">
          <div className="bubble bubble-1"><span /><span /><span /></div>
          <div className="bubble bubble-2"><span /><span /><span /></div>
        </div>
      </div>

      <div className={'row chat-row' + (selected ? ' chat-thread-open' : '')}>
        <div className="chat-list-pane">
          <div className="panel panel-pad chat-toolbar">
            <div className="input-icon-wrap chat-search-wrap">
              <span className="input-icon"><SearchIcon /></span>
              <input
                className="input"
                placeholder="Search chats, name or message…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="chat-filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Chats</option>
              <option value="unread">Unread</option>
              <option value="online">Online</option>
            </select>
          </div>

          <div className="panel chat-convo-list">
            {visibleList.length === 0 && <div className="empty">No conversations match.</div>}
            {visibleList.map((c) => {
              const color = colorFor(c.name)
              return (
                <button
                  key={c.userId}
                  className={'chat-convo-item' + (selected === c.userId ? ' active' : '')}
                  onClick={() => setSelected(c.userId)}
                >
                  <span className="chat-convo-avatar-wrap">
                    <span className="avatar-circle" style={{ background: color.bg, color: color.text, border: 'none' }}>
                      {initials(c.name)}
                    </span>
                    <span className={'chat-presence-dot' + (c.online ? ' online' : '')} />
                  </span>
                  <div className="chat-convo-text">
                    <div className="chat-convo-name">{c.name}</div>
                    <div className="chat-convo-preview muted">
                      {c.lastAt ? (
                        <>
                          {c.lastSender === 'admin' ? 'You: ' : ''}
                          {c.lastMessage || (c.lastAttachmentType === 'image' ? '📷 Photo' : '📎 Attachment')}
                        </>
                      ) : (
                        'No messages yet — start a conversation'
                      )}
                    </div>
                  </div>
                  <div className="chat-convo-meta">
                    {c.lastAt && <div className="chat-convo-time">{relativeTime(c.lastAt)}</div>}
                    {c.unreadCount > 0 && <span className="chat-unread-badge">{c.unreadCount}</span>}
                  </div>
                  <span className="chat-convo-chevron">›</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="panel panel-pad chat-thread-panel">
          {!selected && <div className="empty">Select a conversation.</div>}
          {selected && (
            <>
              <div className="chat-thread-header">
                <button
                  type="button"
                  className="chat-back-btn"
                  onClick={() => setSelected(null)}
                  aria-label="Back to conversations"
                  title="Back to conversations"
                >
                  ‹
                </button>
                <div className="chat-thread-who">
                  <span className="avatar-circle">{initials(active?.name)}</span>
                  <div>
                    <strong>{active?.name}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{active?.email}</div>
                  </div>
                </div>
              </div>
              <ChatThread
                messages={messages}
                mineSender="admin"
                onSend={send}
                placeholder="Reply…"
                theirsAvatar={initials(active?.name)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

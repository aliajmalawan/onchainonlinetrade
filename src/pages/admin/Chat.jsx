import { useEffect, useMemo, useState } from 'react'
import ChatThread from '../../components/ChatThread'
import { apiAdminGetChats, apiAdminGetChat, apiAdminSendChat, apiGetUsers } from '../../lib/backend'

const POLL_MS = 5000

export default function Chat() {
  const [conversations, setConversations] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])

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
      .map((u) => ({ userId: u.id, name: u.name, email: u.email, lastMessage: null, lastSender: null, lastAt: null }))
    return [...withConvo, ...withoutConvo]
  }, [conversations, allUsers])

  useEffect(() => {
    if (!selected) {
      setMessages([])
      return
    }
    loadThread(selected)
    const id = setInterval(() => loadThread(selected), POLL_MS)
    return () => clearInterval(id)
  }, [selected])

  async function send(text) {
    await apiAdminSendChat(selected, text)
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
      <div className="page-head">
        <div className="eyebrow">Admin</div>
        <h1>Live Chat</h1>
        <p>Every user — message anyone, not just those who've already written in.</p>
      </div>

      <div className={'row chat-row' + (selected ? ' chat-thread-open' : '')}>
        <div className="panel chat-convo-list">
          {conversationList.length === 0 && <div className="empty">No users yet.</div>}
          {conversationList.map((c) => (
            <button
              key={c.userId}
              className={'chat-convo-item' + (selected === c.userId ? ' active' : '')}
              onClick={() => setSelected(c.userId)}
            >
              <span className="avatar-circle">{initials(c.name)}</span>
              <div className="chat-convo-text">
                <div className="chat-convo-name">{c.name}</div>
                <div className="chat-convo-preview muted">
                  {c.lastMessage ? (
                    <>
                      {c.lastSender === 'admin' ? 'You: ' : ''}
                      {c.lastMessage}
                    </>
                  ) : (
                    'No messages yet — start a conversation'
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="panel panel-pad chat-thread-panel" style={{ flex: '1 1 420px', minWidth: 0 }}>
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
              <ChatThread messages={messages} mineSender="admin" onSend={send} placeholder="Reply…" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

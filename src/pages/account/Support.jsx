import { useEffect, useState } from 'react'
import ChatThread from '../../components/ChatThread'
import { apiGetSupportChat, apiSendSupportChat } from '../../lib/backend'

const POLL_MS = 4000

const SupportIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
)

// A support-agent headset, shown beside each reply bubble — distinct from
// the speech-bubble brand mark in the header.
const HeadsetIcon = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
)

export default function Support() {
  const [messages, setMessages] = useState([])

  function load() {
    apiGetSupportChat().then(setMessages).catch(() => {})
  }

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [])

  async function send(text, file) {
    await apiSendSupportChat(text, file)
    load()
  }

  return (
    <div className="support-page">
      <div className="panel support-panel">
        <div className="support-chat-header">
          <span className="support-chat-avatar">
            <SupportIcon />
          </span>
          <div>
            <div className="support-chat-title">OnChainTrade Support</div>
            <div className="support-chat-status">
              <span className="support-chat-dot" /> Online
            </div>
          </div>
        </div>

        <ChatThread
          messages={messages}
          mineSender="user"
          onSend={send}
          placeholder="Type a message…"
          theirsAvatar={<HeadsetIcon />}
          brandBackground
        />
      </div>
    </div>
  )
}

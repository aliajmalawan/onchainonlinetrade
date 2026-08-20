import { useEffect, useState } from 'react'
import ChatThread from '../../components/ChatThread'
import { apiGetSupportChat, apiSendSupportChat } from '../../lib/backend'

const POLL_MS = 4000

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

  async function send(text) {
    await apiSendSupportChat(text)
    load()
  }

  return (
    <div className="support-page">
      <div className="page-head">
        <div className="eyebrow">Account</div>
        <h1>Customer Support</h1>
        <p>Send a message and our team will reply here.</p>
      </div>

      <div className="panel panel-pad support-panel">
        <ChatThread messages={messages} mineSender="user" onSend={send} placeholder="Describe your issue…" />
      </div>
    </div>
  )
}

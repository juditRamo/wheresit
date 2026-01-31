import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '../types'
import './MessageList.css'

interface MessageListProps {
  messages: ChatMessage[]
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="message-list message-list--empty">
        <p>Tell me where you put something, or ask where something is.</p>
        <p className="message-list__hint">e.g. “Keys are in the drawer” or “Where are the keys?”</p>
      </div>
    )
  }

  return (
    <div className="message-list">
      {messages.map((m) => (
        <div key={m.id} className={`message message--${m.role}`}>
          <div className="message__content">
            {m.role === 'assistant' ? (
              <ReactMarkdown>{m.content}</ReactMarkdown>
            ) : (
              m.content
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { MessageList } from './MessageList'
import { sendChatMessage } from '../api/chat'
import { useStoredItems } from '../hooks/useStoredItems'
import type { ChatMessage } from '../types'
import './Chat.css'

interface ChatProps {
  householdId: string
}

function genId() {
  return crypto.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function Chat({ householdId }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { items: storedItems, refetch: refetchStoredItems } = useStoredItems(householdId)

  const showSuggestions = storedItems.length > 0 && (input === '' || /^where\s*(is|are)?\s*/i.test(input.trim()))
  const suggestionQuery = input.trim().replace(/^where\s*(is|are)?\s*/i, '').toLowerCase()
  const suggestedItems = showSuggestions
    ? storedItems.filter((name) => !suggestionQuery || name.toLowerCase().includes(suggestionQuery)).slice(0, 6)
    : []

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)
    const userMessage: ChatMessage = {
      id: genId(),
      role: 'user',
      content: text,
      createdAt: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setLoading(true)

    try {
      const { reply } = await sendChatMessage(text, householdId)
      refetchStoredItems()
      const assistantMessage: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: reply,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      const errMessage: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: "I couldn't process that. Please try again.",
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, errMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat">
      <div className="chat__messages" ref={listRef}>
        <MessageList messages={messages} />
      </div>
      {error && (
        <div className="chat__error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="chat__form">
        <div className="chat__input-wrap">
          <input
            type="text"
            placeholder="Where did you put something? Or ask where something is…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="chat__input"
            autoComplete="off"
          />
          {suggestedItems.length > 0 && (
            <ul className="chat__suggestions" role="listbox">
              {suggestedItems.map((name) => (
                <li
                  key={name}
                  role="option"
                  className="chat__suggestion"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setInput(`Where is ${name}?`)
                  }}
                >
                  Where is {name}?
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? '…' : 'Send'}
        </button>
      </form>
    </div>
  )
}

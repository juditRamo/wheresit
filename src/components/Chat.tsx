import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Send } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { SpeechRecognition as NativeSpeechRecognition } from '@capacitor-community/speech-recognition'
import { MessageList } from './MessageList'
import { sendChatMessage } from '../api/chat'
import { useStoredItems } from '../hooks/useStoredItems'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import type { ChatMessage, LocationRef, PendingUpdate } from '../types'
import type { Lang } from '../i18n/picklists'
import './Chat.css'

interface ChatProps {
  householdId: string
  onNavigateToItems: (filter: LocationRef) => void
}

function genId() {
  return crypto.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Web Speech API types
interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

interface SpeechRecognitionErrorEvent {
  error: string
}

type SpeechRecognitionInstance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

function detectLanguageFromText(text: string): Lang {
  const lower = text.toLowerCase()
  if (/(?:dejé|guardé|puse|dónde|está|están|por favor|tengo|las?|los?|el\s|en\s(?:el|la|los|las))/.test(lower)) {
    return 'es'
  }
  return 'en'
}

export function Chat({ householdId, onNavigateToItems }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [pendingLanguage, setPendingLanguage] = useState<Lang | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const { items: storedItems, refetch: refetchStoredItems } = useStoredItems(householdId)
  const { language, setLanguage } = useLanguage()

  const suggestionPrefix = ui('chat.suggestion_prefix', language)
  const showSuggestions = storedItems.length > 0 && (input === '' || /^(?:where\s*(is|are)?\s*|(?:d[oó]nde)\s*(?:est[aá]|est[aá]n|dej[eé]|guard[eé]|puse)?\s*)/i.test(input.trim()))
  const suggestionQuery = input.trim()
    .replace(/^where\s*(is|are)?\s*/i, '')
    .replace(/^(?:d[oó]nde)\s*(?:est[aá]|est[aá]n|dej[eé]|guard[eé]|puse)?\s*/i, '')
    .toLowerCase()
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
    await sendMessage(text)
  }

  async function sendMessage(text: string, options?: { confirm?: boolean; confirmPlaceId?: string }) {
    setInput('')
    setError(null)

    if (!options?.confirm && !options?.confirmPlaceId) {
      const detectedLang = detectLanguageFromText(text)
      setPendingLanguage(detectedLang)

      const userMessage: ChatMessage = {
        id: genId(),
        role: 'user',
        content: text,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])
    }
    setLoading(true)

    try {
      const response = await sendChatMessage(text, householdId, options)
      setLanguage(response.language)
      refetchStoredItems()

      if (response.pendingUpdate) {
        const assistantMessage: ChatMessage = {
          id: genId(),
          role: 'assistant',
          content: response.reply,
          createdAt: new Date(),
          pendingUpdate: response.pendingUpdate,
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else if (response.pendingPlaceMatch) {
        const assistantMessage: ChatMessage = {
          id: genId(),
          role: 'assistant',
          content: response.reply,
          createdAt: new Date(),
          pendingPlaceMatch: response.pendingPlaceMatch,
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        const assistantMessage: ChatMessage = {
          id: genId(),
          role: 'assistant',
          content: response.reply,
          createdAt: new Date(),
          locationRef: response.locationRef,
          queryResults: response.queryResults,
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      const errMessage: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: ui('chat.error_apology', language),
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, errMessage])
    } finally {
      setLoading(false)
      setPendingLanguage(null)
    }
  }

  const handleConfirm = useCallback(async (pending: PendingUpdate) => {
    const text = `${pending.item_name} in ${pending.newLocation}`
    await sendMessage(text, { confirm: true })
    setMessages((prev) => prev.filter((m) => !m.pendingUpdate || m.pendingUpdate.entryId !== pending.entryId))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId])

  const handleConfirmPlace = useCallback(async (lastUserMessage: string, placeId: string) => {
    await sendMessage(lastUserMessage, { confirmPlaceId: placeId })
    setMessages((prev) => prev.filter((m) => !m.pendingPlaceMatch || m.pendingPlaceMatch.suggestedPlaceId !== placeId))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId])

  const handleCancelPending = useCallback((pending: PendingUpdate) => {
    setMessages((prev) => prev.filter((m) => !m.pendingUpdate || m.pendingUpdate.entryId !== pending.entryId))
  }, [])

  const handleCancelPlaceMatch = useCallback((placeId: string) => {
    setMessages((prev) => prev.filter((m) => !m.pendingPlaceMatch || m.pendingPlaceMatch.suggestedPlaceId !== placeId))
  }, [])

  // Voice input
  function handleMicClick() {
    if (Capacitor.isNativePlatform()) {
      handleNativeMic()
      return
    }

    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setError(ui('voice.not_supported', language))
      return
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = language === 'es' ? 'es-ES' : 'en-US'
    recognition.interimResults = false
    recognition.continuous = false
    recognitionRef.current = recognition

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
    }

    recognition.onerror = () => {
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    setIsRecording(true)
    recognition.start()
  }

  async function handleNativeMic() {
    if (isRecording) {
      NativeSpeechRecognition.stop()
      setIsRecording(false)
      return
    }

    try {
      const { speechRecognition } = await NativeSpeechRecognition.checkPermissions()
      if (speechRecognition !== 'granted') {
        const result = await NativeSpeechRecognition.requestPermissions()
        if (result.speechRecognition !== 'granted') {
          setError(ui('voice.not_supported', language))
          return
        }
      }

      setIsRecording(true)
      const { matches } = await NativeSpeechRecognition.start({
        language: language === 'es' ? 'es-ES' : 'en-US',
        popup: false,
        partialResults: false,
      })

      if (matches?.[0]) {
        setInput(matches[0])
      }
    } catch {
      // User cancelled or error
    } finally {
      setIsRecording(false)
    }
  }

  return (
    <div className="chat">
      <div className="chat__messages" ref={listRef}>
        <MessageList
          messages={messages}
          onLocationClick={onNavigateToItems}
          onConfirmPending={handleConfirm}
          onCancelPending={handleCancelPending}
          onConfirmPlaceMatch={handleConfirmPlace}
          onCancelPlaceMatch={handleCancelPlaceMatch}
          isLoading={loading}
          loadingText={pendingLanguage === 'es' ? 'Pensando...' : 'Thinking...'}
        />
      </div>
      {error && (
        <div className="chat__error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="chat__input-bar">
        <button
          type="button"
          className={`chat__mic-btn ${isRecording ? 'chat__mic-btn--recording' : ''}`}
          aria-label="Voice input"
          onClick={handleMicClick}
        >
          <Mic size={20} color="var(--cream)" />
        </button>
        <div className="chat__input-wrap">
          <input
            type="text"
            placeholder={isRecording ? ui('voice.listening', language) : ui('chat.placeholder', language)}
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
                    setInput(language === 'es' ? `¿${suggestionPrefix} ${name}?` : `${suggestionPrefix} ${name}?`)
                  }}
                >
                  {language === 'es' ? `¿${suggestionPrefix} ${name}?` : `${suggestionPrefix} ${name}?`}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="chat__send-btn"
          aria-label="Send message"
        >
          <Send size={18} color="var(--text-on-gold)" />
        </button>
      </form>
    </div>
  )
}

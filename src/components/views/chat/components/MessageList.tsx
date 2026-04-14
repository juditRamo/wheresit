import { ConciergeBell, MapPin, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'
import type { ChatMessage, LocationRef, PendingUpdate, PendingDuplicateChoice } from '../../../../types'
import { formatTime } from '../helpers'
import { MultiResultCard } from './MultiResultCard'
import { ConfirmCard, ConfirmPlaceCard, DuplicateChoiceCard } from './ConfirmCards'
import './MessageList.css'

interface MessageListProps {
  messages: ChatMessage[]
  onLocationClick: (filter: LocationRef) => void
  onConfirmPending?: (pending: PendingUpdate) => void
  onCancelPending?: (pending: PendingUpdate) => void
  onConfirmPlaceMatch?: (lastUserMessage: string, placeId: string) => void
  onCancelPlaceMatch?: (placeId: string) => void
  onConfirmMove?: (choice: PendingDuplicateChoice) => void
  onConfirmAdd?: (choice: PendingDuplicateChoice) => void
  onCancelDuplicate?: () => void
  isLoading?: boolean
  loadingText?: string
}

export function MessageList({
  messages,
  onLocationClick,
  onConfirmPending,
  onCancelPending,
  onConfirmPlaceMatch,
  onCancelPlaceMatch,
  onConfirmMove,
  onConfirmAdd,
  onCancelDuplicate,
  isLoading,
  loadingText,
}: MessageListProps) {
  const { language } = useLanguage()

  if (messages.length === 0) {
    return (
      <div className="message-list message-list--empty">
        <div className="message-list__empty-avatar">
          <ConciergeBell size={24} color="var(--gold-primary)" />
        </div>
        <p className="message-list__empty-title">{ui('empty.title', language)}</p>
        <p className="message-list__empty-hint">{ui('empty.hint', language)}</p>
      </div>
    )
  }

  const loadingMessage = loadingText ?? ui('chat.loading', language)

  return (
    <div className="message-list">
      {messages.map((m, idx) => (
        <div key={m.id} className={`message message--${m.role}`}>
          {m.role === 'assistant' && (
            <div className="message__avatar">
              <ConciergeBell size={16} color="var(--gold-primary)" />
            </div>
          )}
          <div className="message__bubble-wrap">
            <div className="message__bubble">
              <div className="message__text">
                {m.role === 'assistant' ? (
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
              <span className="message__time">{formatTime(m.createdAt)}</span>
            </div>
            {/* Multi-result list */}
            {m.role === 'assistant' && m.queryResults && m.queryResults.length > 1 && (
              <MultiResultCard results={m.queryResults} onLocationClick={onLocationClick} />
            )}
            {/* Single location card */}
            {m.role === 'assistant' && m.locationRef && !(m.queryResults && m.queryResults.length > 1) && (
              <div className="location-card">
                <MapPin size={14} color="var(--gold-primary)" className="location-card__pin" />
                <button
                  className="location-card__chip"
                  onClick={() => onLocationClick(
                    m.locationRef!.place_id
                      ? { place_id: m.locationRef!.place_id, place_label: m.locationRef!.place_label }
                      : { location_description: m.locationRef!.place_label ?? m.locationRef!.location_description ?? '' }
                  )}
                >
                  {m.locationRef.place_label ?? m.locationRef.place_id ?? m.locationRef.location_description ?? ''}
                </button>
                <span className="location-card__hint">
                  {ui('location.tap', language)} <ChevronRight size={10} />
                </span>
              </div>
            )}
            {/* Overwrite confirmation card */}
            {m.role === 'assistant' && m.pendingUpdate && onConfirmPending && onCancelPending && (
              <ConfirmCard
                pending={m.pendingUpdate}
                onConfirm={() => onConfirmPending(m.pendingUpdate!)}
                onCancel={() => onCancelPending(m.pendingUpdate!)}
              />
            )}
            {/* Place match confirmation card */}
            {m.role === 'assistant' && m.pendingPlaceMatch && onConfirmPlaceMatch && onCancelPlaceMatch && (
              <ConfirmPlaceCard
                pending={m.pendingPlaceMatch}
                onConfirm={() => {
                  const prev = messages[idx - 1]
                  if (prev?.role === 'user') onConfirmPlaceMatch(prev.content, m.pendingPlaceMatch!.suggestedPlaceId)
                }}
                onCancel={() => onCancelPlaceMatch(m.pendingPlaceMatch!.suggestedPlaceId)}
              />
            )}
            {/* Duplicate item choice card */}
            {m.role === 'assistant' && m.pendingDuplicateChoice && onConfirmMove && onConfirmAdd && onCancelDuplicate && (
              <DuplicateChoiceCard
                choice={m.pendingDuplicateChoice}
                onMove={() => onConfirmMove(m.pendingDuplicateChoice!)}
                onAdd={() => onConfirmAdd(m.pendingDuplicateChoice!)}
                onCancel={onCancelDuplicate}
              />
            )}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="message message--assistant message--loading">
          <div className="message__avatar">
            <ConciergeBell size={16} color="var(--gold-primary)" />
          </div>
          <div className="message__bubble-wrap">
            <div className="message__bubble">
              <div className="message__text">
                <em>{loadingMessage}</em>
              </div>
              <span className="message__time">{formatTime(new Date())}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

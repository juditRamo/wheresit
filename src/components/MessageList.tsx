import { ConciergeBell, MapPin, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import type { ChatMessage, LocationRef, QueryResult, PendingUpdate, PendingPlaceMatch } from '../types'
import './MessageList.css'

interface MessageListProps {
  messages: ChatMessage[]
  onLocationClick: (filter: LocationRef) => void
  onConfirmPending?: (pending: PendingUpdate) => void
  onCancelPending?: (pending: PendingUpdate) => void
  onConfirmPlaceMatch?: (lastUserMessage: string, placeId: string) => void
  onCancelPlaceMatch?: (placeId: string) => void
  isLoading?: boolean
  loadingText?: string
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function buildResultLocation(r: QueryResult): string {
  return r.location_description
}

function MultiResultCard({ results, onLocationClick }: { results: QueryResult[]; onLocationClick: (filter: LocationRef) => void }) {
  return (
    <div className="multi-result-card">
      {results.map((r, i) => (
        <button
          key={i}
          className="multi-result-card__item"
          onClick={() => {
            if (r.place_id) {
              onLocationClick({ place_id: r.place_id })
            } else {
              onLocationClick({ location_description: r.location_description })
            }
          }}
        >
          <span className="multi-result-card__name">{r.item_name}</span>
          <span className="multi-result-card__loc">{buildResultLocation(r)}</span>
        </button>
      ))}
    </div>
  )
}

function ConfirmPlaceCard({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingPlaceMatch
  onConfirm: () => void
  onCancel: () => void
}) {
  const { language } = useLanguage()
  return (
    <div className="confirm-card">
      <p className="confirm-card__text">
        {language === 'es'
          ? `¿Te refieres al lugar "${pending.suggestedPlaceLabel}"?`
          : `Do you mean the place "${pending.suggestedPlaceLabel}"?`}
      </p>
      <div className="confirm-card__actions">
        <button className="confirm-card__btn confirm-card__btn--cancel" onClick={onCancel}>
          {ui('confirm.cancel', language)}
        </button>
        <button className="confirm-card__btn confirm-card__btn--confirm" onClick={onConfirm}>
          {ui('confirm.confirm', language)}
        </button>
      </div>
    </div>
  )
}

function ConfirmCard({ pending, onConfirm, onCancel }: { pending: PendingUpdate; onConfirm: () => void; onCancel: () => void }) {
  const { language } = useLanguage()

  return (
    <div className="confirm-card">
      <p className="confirm-card__text">
        {ui('confirm.move_prompt', language, {
          item: pending.item_name,
          old: pending.oldLocation,
          new: pending.newLocation,
        })}
      </p>
      <div className="confirm-card__actions">
        <button className="confirm-card__btn confirm-card__btn--cancel" onClick={onCancel}>
          {ui('confirm.cancel', language)}
        </button>
        <button className="confirm-card__btn confirm-card__btn--confirm" onClick={onConfirm}>
          {ui('confirm.confirm', language)}
        </button>
      </div>
    </div>
  )
}

export function MessageList({
  messages,
  onLocationClick,
  onConfirmPending,
  onCancelPending,
  onConfirmPlaceMatch,
  onCancelPlaceMatch,
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

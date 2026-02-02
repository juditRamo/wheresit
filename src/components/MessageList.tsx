import { useState } from 'react'
import { ConciergeBell, MapPin, ChevronRight, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import { t, ROOMS, SPOTS, SPOT_DETAILS } from '../i18n/picklists'
import type { ChatMessage, LocationRef, NewTag, QueryResult, PendingUpdate } from '../types'
import './MessageList.css'

interface MessageListProps {
  messages: ChatMessage[]
  onLocationClick: (filter: LocationRef) => void
  onSaveTag: (tag: NewTag) => void
  onConfirmPending?: (pending: PendingUpdate) => void
  onCancelPending?: (pending: PendingUpdate) => void
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function buildResultLocation(r: QueryResult, lang: 'en' | 'es'): string {
  if (r.room_key) {
    const parts: string[] = []
    const room = t(ROOMS, r.room_key, lang)
    if (room) parts.push(room)
    const spot = t(SPOTS, r.spot_key, lang)
    if (spot) parts.push(spot)
    const detail = t(SPOT_DETAILS, r.spot_detail, lang)
    if (detail) parts.push(detail)
    return parts.join(' \u203A ')
  }
  return r.location_description
}

function TagSaveCard({ tags, onSaveTag }: { tags: NewTag[]; onSaveTag: (tag: NewTag) => void }) {
  const { language } = useLanguage()
  const [saved, setSaved] = useState<Set<string>>(new Set())

  function handleSave(tag: NewTag) {
    onSaveTag(tag)
    setSaved((prev) => new Set(prev).add(`${tag.type}:${tag.key}`))
  }

  return (
    <div className="tag-save-card">
      <span className="tag-save-card__title">{ui('tags.save_prompt', language)}</span>
      <div className="tag-save-card__chips">
        {tags.map((tag) => {
          const id = `${tag.type}:${tag.key}`
          const isSaved = saved.has(id)
          return (
            <button
              key={id}
              className={`tag-save-card__chip ${isSaved ? 'tag-save-card__chip--saved' : ''}`}
              onClick={() => !isSaved && handleSave(tag)}
              disabled={isSaved}
            >
              {isSaved ? (
                <>
                  <Check size={10} /> {ui('tags.saved', language)}
                </>
              ) : (
                <>{tag.label} +</>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MultiResultCard({ results, onLocationClick }: { results: QueryResult[]; onLocationClick: (filter: LocationRef) => void }) {
  const { language } = useLanguage()

  return (
    <div className="multi-result-card">
      {results.map((r, i) => (
        <button
          key={i}
          className="multi-result-card__item"
          onClick={() => {
            if (r.room_key) {
              onLocationClick({ room_key: r.room_key, spot_key: r.spot_key ?? undefined })
            }
          }}
        >
          <span className="multi-result-card__name">{r.item_name}</span>
          <span className="multi-result-card__loc">{buildResultLocation(r, language)}</span>
        </button>
      ))}
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

export function MessageList({ messages, onLocationClick, onSaveTag, onConfirmPending, onCancelPending }: MessageListProps) {
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

  return (
    <div className="message-list">
      {messages.map((m) => (
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
                  onClick={() => onLocationClick({ room_key: m.locationRef!.room_key })}
                >
                  {t(ROOMS, m.locationRef.room_key, language)}
                </button>
                {m.locationRef.spot_key && (
                  <>
                    <ChevronRight size={12} className="location-card__sep" />
                    <button
                      className="location-card__chip"
                      onClick={() => onLocationClick({ room_key: m.locationRef!.room_key, spot_key: m.locationRef!.spot_key })}
                    >
                      {t(SPOTS, m.locationRef.spot_key, language)}
                    </button>
                  </>
                )}
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
            {/* Tag save card */}
            {m.role === 'assistant' && m.newTags && m.newTags.length > 0 && (
              <TagSaveCard tags={m.newTags} onSaveTag={onSaveTag} />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

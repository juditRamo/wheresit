import { createElement } from 'react'
import { Package, Plus, ArrowRight, Pencil, X, type LucideIcon } from 'lucide-react'
import type { ActivityEntry } from '../../../../hooks/useActivityFeed'
import { getPlaceIcon } from '../../../../lib/placeIcons'
import type { HistoryEventType } from '../../../../types'
import { timeAgo, getLocationFromPayload } from '../helpers'

const ACTION_BADGE_ICON: Record<string, LucideIcon> = {
  add_object: Plus,
  move_object: ArrowRight,
  edit_object: Pencil,
  delete_object: X,
  add_place: Plus,
  move_place: ArrowRight,
  edit_place: Pencil,
  delete_place: X,
}

const LEGACY_FIELD_LABELS: Record<string, { en: string; es: string }> = {
  item_name: { en: 'Name', es: 'Nombre' },
  photo_path: { en: 'Photo', es: 'Foto' },
  label: { en: 'Name', es: 'Nombre' },
  icon: { en: 'Icon', es: 'Icono' },
  location_description: { en: 'Location', es: 'Ubicación' },
}

const EVENT_TEXT_CONFIG: Record<HistoryEventType, {
  en: string; es: string
  prep?: { en: string; es: string }
}> = {
  add_object:    { en: 'added',         es: 'añadió',        prep: { en: 'at', es: 'en' } },
  move_object:   { en: 'moved',         es: 'movió',         prep: { en: 'to', es: 'a' } },
  edit_object:   { en: 'edited',        es: 'editó' },
  delete_object: { en: 'deleted',       es: 'eliminó' },
  add_place:     { en: 'added place',   es: 'añadió lugar' },
  move_place:    { en: 'moved',         es: 'movió',         prep: { en: 'to', es: 'a' } },
  edit_place:    { en: 'edited place',  es: 'editó lugar' },
  delete_place:  { en: 'deleted place', es: 'eliminó lugar' },
}

function DiffLines({ changes, language }: { changes: Record<string, unknown>; language: 'en' | 'es' }) {
  const entries = Object.entries(changes)
  if (entries.length === 0) return null

  return (
    <div className="activity-view__diff">
      {entries.map(([field, value]) => {
        if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
          const { from, to } = value as { from: unknown; to: unknown }
          const fromStr = from != null ? String(from) : ''
          const toStr = to != null ? String(to) : ''
          const fieldLabel = LEGACY_FIELD_LABELS[field]?.[language] ?? field
          if (!fromStr && toStr) {
            return <div key={field} className="activity-view__diff-line">{fieldLabel}: <span className="activity-view__diff-add">{toStr}</span></div>
          }
          if (fromStr && !toStr) {
            return <div key={field} className="activity-view__diff-line">{fieldLabel}: <span className="activity-view__diff-remove">{fromStr}</span></div>
          }
          return (
            <div key={field} className="activity-view__diff-line">
              {fieldLabel}: <span className="activity-view__diff-remove">{fromStr}</span> → <span className="activity-view__diff-add">{toStr}</span>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

function EventText({
  entry,
  language,
  actorName,
}: {
  entry: ActivityEntry
  language: 'en' | 'es'
  actorName: string
}) {
  const payload = entry.payload
  const itemName = (payload.item_name as string) ?? '?'
  const label = (payload.label as string) ?? '?'
  const location = getLocationFromPayload(payload, entry.event_type)
  const isPlace = entry.entity_type === 'place'
  const entityName = isPlace ? label : itemName

  const nameSpan = (
    <strong className={isPlace ? 'activity-view__place-name' : 'activity-view__entity-name'}>{entityName}</strong>
  )

  const config = EVENT_TEXT_CONFIG[entry.event_type]
  const verb = config[language]

  if (config.prep) {
    const locSpan = location && location !== '—'
      ? <span className="activity-view__location">{location}</span>
      : <>{location || '—'}</>
    return <>{actorName} {verb} {nameSpan} {config.prep[language]} {locSpan}</>
  }

  return <>{actorName} {verb} {nameSpan}</>
}

interface ActivityEventRowProps {
  entry: ActivityEntry
  language: 'en' | 'es'
  actorName: string
  isDeleted: boolean
  placeIconId: string | null
  onTap: () => void
}

export function ActivityEventRow({
  entry,
  language,
  actorName,
  isDeleted,
  placeIconId,
  onTap,
}: ActivityEventRowProps) {
  const isDeleteEvent = entry.event_type === 'delete_object' || entry.event_type === 'delete_place'
  const disabled = isDeleteEvent || isDeleted
  const changes = (entry.payload.changes as Record<string, unknown>) ?? null
  const isEdit = entry.event_type === 'edit_object' || entry.event_type === 'edit_place'

  const isPlace = entry.entity_type === 'place'
  const entityIcon = isPlace ? getPlaceIcon(placeIconId ?? 'map-pin') : Package
  const badgeIcon = ACTION_BADGE_ICON[entry.event_type] ?? Plus

  return (
    <div
      className={`activity-view__row ${disabled ? 'activity-view__row--disabled' : 'activity-view__row--tappable'}`}
      onClick={disabled ? undefined : onTap}
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      onKeyDown={disabled ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } }}
    >
      <div className="activity-view__icon-bubble">
        {createElement(entityIcon, { size: 18, className: 'activity-view__icon-bubble-icon' })}
        <span className="activity-view__action-badge">{createElement(badgeIcon, { size: 10 })}</span>
      </div>
      <div className="activity-view__row-body">
        <div className="activity-view__row-text">
          <EventText entry={entry} language={language} actorName={actorName} />
        </div>
        {isEdit && changes && <DiffLines changes={changes} language={language} />}
        <div className="activity-view__row-time">{timeAgo(entry.created_at, language)}</div>
      </div>
    </div>
  )
}

import { MoveRight, Plus, Pencil, Trash2, MapPin } from 'lucide-react'
import { useActivityFeed } from '../hooks/useActivityFeed'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import type { ActivityEntry } from '../hooks/useActivityFeed'
import type { HistoryEventType } from '../types'
import './ActivityFeed.css'

interface ActivityFeedProps {
  householdId: string
}

function timeAgo(dateStr: string, lang: 'en' | 'es'): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return ui('activity.ago', lang, { time: ui('activity.minutes', lang, { n: Math.max(1, minutes) }) })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return ui('activity.ago', lang, { time: ui('activity.hours', lang, { n: hours }) })
  const days = Math.floor(hours / 24)
  return ui('activity.ago', lang, { time: ui('activity.days', lang, { n: days }) })
}

function getLocationFromPayload(payload: Record<string, unknown>, eventType: HistoryEventType): string {
  if (eventType === 'move_object' && payload.to && typeof payload.to === 'object') {
    const to = payload.to as Record<string, unknown>
    return (to.location_description as string) ?? (to.place_id as string) ?? '—'
  }
  if (eventType === 'add_object' || eventType === 'move_object') {
    return (payload.location_description as string) ?? '—'
  }
  if (eventType === 'move_place' && payload.to_parent_place_id !== undefined) {
    return payload.to_parent_place_id ? String(payload.to_parent_place_id) : ''
  }
  return (payload.path_or_description as string) ?? (payload.last_location_description as string) ?? '—'
}

function ActivityItem({ a, language }: { a: ActivityEntry; language: 'en' | 'es' }) {
  const payload = a.payload
  const itemName = (payload.item_name as string) ?? '?'
  const label = (payload.label as string) ?? '?'
  const location = getLocationFromPayload(payload, a.event_type)
  const userLabel = a.actor_id ? a.actor_id.slice(0, 8) : '?'

  const eventConfig: Record<HistoryEventType, { key: string; vars: Record<string, string>; Icon: typeof MoveRight }> = {
    add_object: {
      key: 'activity.added_object',
      vars: { item: itemName, location: location || '—' },
      Icon: Plus,
    },
    move_object: {
      key: 'activity.moved_object',
      vars: { item: itemName, location: location || '—' },
      Icon: MoveRight,
    },
    edit_object: { key: 'activity.edit_object', vars: { item: itemName }, Icon: Pencil },
    delete_object: { key: 'activity.delete_object', vars: { item: itemName }, Icon: Trash2 },
    add_place: { key: 'activity.add_place', vars: { label }, Icon: Plus },
    move_place: {
      key: 'activity.moved_place',
      vars: { label, location: location || ui('places.root', language) },
      Icon: MapPin,
    },
    edit_place: { key: 'activity.edit_place', vars: { label }, Icon: Pencil },
    delete_place: { key: 'activity.delete_place', vars: { label }, Icon: Trash2 },
  }

  const config = eventConfig[a.event_type]
  if (!config) return null
  const text = ui(config.key, language, config.vars)
  const Icon = config.Icon

  return (
    <div className="activity-feed__item">
      <div className="activity-feed__avatar">{userLabel.slice(0, 2)}</div>
      <div className="activity-feed__content">
        <div className="activity-feed__text">
          <Icon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          {text}
        </div>
        <div className="activity-feed__time">{timeAgo(a.created_at, language)}</div>
      </div>
    </div>
  )
}

export function ActivityFeed({ householdId }: ActivityFeedProps) {
  const { activities, loading } = useActivityFeed(householdId)
  const { language } = useLanguage()

  if (!loading && activities.length === 0) {
    return (
      <div className="activity-feed__empty">
        <p>{ui('inventory.empty', language)}</p>
      </div>
    )
  }

  return (
    <div className="activity-feed">
      {activities.map((a) => (
        <ActivityItem key={a.id} a={a} language={language} />
      ))}
    </div>
  )
}

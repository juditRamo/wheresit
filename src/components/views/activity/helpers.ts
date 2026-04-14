import { ui } from '../../../i18n/ui'
import type { HistoryEventType } from '../../../types'

export function formatDateLabel(dateKey: string, lang: 'en' | 'es'): string {
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)

  if (dateKey === todayKey) return ui('activity.today', lang)
  if (dateKey === yesterdayKey) return ui('activity.yesterday', lang)

  const d = new Date(dateKey + 'T00:00:00')
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    month: 'long',
    day: 'numeric',
  })
}

export function timeAgo(dateStr: string, lang: 'en' | 'es'): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return ui('activity.ago', lang, { time: ui('activity.minutes', lang, { n: Math.max(1, minutes) }) })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return ui('activity.ago', lang, { time: ui('activity.hours', lang, { n: hours }) })
  const days = Math.floor(hours / 24)
  if (days < 7) return ui('activity.ago', lang, { time: ui('activity.days', lang, { n: days }) })
  const d = new Date(dateStr)
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })
}

export function getLocationFromPayload(payload: Record<string, unknown>, eventType: HistoryEventType): string {
  if (eventType === 'move_object' && payload.to && typeof payload.to === 'object') {
    const to = payload.to as Record<string, unknown>
    return (to.location_description as string) ?? '—'
  }
  if (eventType === 'add_object') {
    return (payload.location_description as string) ?? '—'
  }
  return '—'
}

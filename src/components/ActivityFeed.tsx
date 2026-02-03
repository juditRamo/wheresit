import { MoveRight } from 'lucide-react'
import { useActivityFeed } from '../hooks/useActivityFeed'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
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
      {activities.map((a) => {
        const userLabel = a.moved_by ? a.moved_by.slice(0, 8) : '?'
        const location = a.location_description
        return (
          <div key={a.id} className="activity-feed__item">
            <div className="activity-feed__avatar">{userLabel.slice(0, 2)}</div>
            <div className="activity-feed__content">
              <div className="activity-feed__text">
                <MoveRight size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                <strong>{a.item_name ?? '?'}</strong> → {location}
              </div>
              <div className="activity-feed__time">{timeAgo(a.moved_at, language)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

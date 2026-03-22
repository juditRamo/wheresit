import { Archive, Home, Clock, AlertTriangle } from 'lucide-react'
import { ui } from '../i18n/ui'
import type { Lang } from '../i18n/picklists'
import './DashboardCards.css'

interface DashboardStats {
  totalItems: number
  topRooms: [string, number][]
  mostPopulatedRoom: string | null
  forgottenCount: number
  recentlyMovedCount: number
}

interface DashboardCardsProps {
  stats: DashboardStats
  language: Lang
  onForgottenClick?: () => void
}

export function DashboardCards({ stats, language, onForgottenClick }: DashboardCardsProps) {
  if (stats.totalItems === 0) return null

  const roomLabel = stats.mostPopulatedRoom ?? '—'

  return (
    <div className="dashboard">
      <div className="dashboard__card">
        <div className="dashboard__card-icon">
          <Archive size={16} color="var(--gold-primary)" />
        </div>
        <div className="dashboard__card-info">
          <span className="dashboard__card-value">{stats.totalItems}</span>
          <span className="dashboard__card-label">{ui('dash.total_items', language)}</span>
        </div>
      </div>

      <div className="dashboard__card">
        <div className="dashboard__card-icon">
          <Home size={16} color="var(--gold-primary)" />
        </div>
        <div className="dashboard__card-info">
          <span className="dashboard__card-value">{roomLabel}</span>
          <span className="dashboard__card-label">{ui('dash.most_used_room', language)}</span>
        </div>
      </div>

      <div
        className="dashboard__card dashboard__card--clickable"
        onClick={onForgottenClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onForgottenClick?.() }}
      >
        <div className="dashboard__card-icon">
          <AlertTriangle size={16} color="var(--gold-primary)" />
        </div>
        <div className="dashboard__card-info">
          <span className="dashboard__card-value">{stats.forgottenCount}</span>
          <span className="dashboard__card-label">{ui('dash.forgotten', language)}</span>
        </div>
      </div>

      <div className="dashboard__card">
        <div className="dashboard__card-icon">
          <Clock size={16} color="var(--gold-primary)" />
        </div>
        <div className="dashboard__card-info">
          <span className="dashboard__card-value">{stats.recentlyMovedCount}</span>
          <span className="dashboard__card-label">{ui('dash.recently_moved', language)}</span>
        </div>
      </div>
    </div>
  )
}

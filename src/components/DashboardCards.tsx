import { Archive, MapPin, Camera, Clock } from 'lucide-react'
import { ui } from '../i18n/ui'
import type { Lang } from '../i18n/picklists'
import './DashboardCards.css'

interface DashboardStats {
  totalItems: number
  placesUsed: number
  withPhotos: number
  recentlyMovedCount: number
}

interface DashboardCardsProps {
  stats: DashboardStats
  language: Lang
}

export function DashboardCards({ stats, language }: DashboardCardsProps) {
  if (stats.totalItems === 0) return null

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
          <MapPin size={16} color="var(--gold-primary)" />
        </div>
        <div className="dashboard__card-info">
          <span className="dashboard__card-value">{stats.placesUsed}</span>
          <span className="dashboard__card-label">{ui('dash.places_used', language)}</span>
        </div>
      </div>

      <div className="dashboard__card">
        <div className="dashboard__card-icon">
          <Camera size={16} color="var(--gold-primary)" />
        </div>
        <div className="dashboard__card-info">
          <span className="dashboard__card-value">{stats.withPhotos}</span>
          <span className="dashboard__card-label">{ui('dash.with_photos', language)}</span>
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

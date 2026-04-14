import { useRef, useCallback } from 'react'
import type { ActivityDayGroup } from '../../../../hooks/useActivityFeed'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'
import type { HistoryEntityType } from '../../../../types'
import { formatDateLabel } from '../helpers'
import { ActivityEventRow } from './ActivityEventRow'

interface ActivityFeedProps {
  grouped: ActivityDayGroup[]
  loading: boolean
  hasMore: boolean
  loadMore: () => void
  actorNames: Record<string, string>
  deletedEntityIds: Set<string>
  placeIcons: Record<string, string>
  hasFilters: boolean
  onNavigateToEntity: (entityType: HistoryEntityType, entityId: string) => void
}

export function ActivityFeed({
  grouped,
  loading,
  hasMore,
  loadMore,
  actorNames,
  deletedEntityIds,
  placeIcons,
  hasFilters,
  onNavigateToEntity,
}: ActivityFeedProps) {
  const { language } = useLanguage()
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || loading || !hasMore) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadMore()
    }
  }, [loading, hasMore, loadMore])

  const isEmpty = !loading && grouped.length === 0

  return (
    <div className="activity-view__feed" ref={scrollRef} onScroll={handleScroll}>
      {grouped.map((group) => (
        <div key={group.dateKey} className="activity-view__day">
          <div className="activity-view__day-header">{formatDateLabel(group.dateKey, language)}</div>
          {group.entries.map((entry) => (
            <ActivityEventRow
              key={entry.id}
              entry={entry}
              language={language}
              actorName={entry.actor_id ? (actorNames[entry.actor_id] ?? entry.actor_id.slice(0, 8)) : '?'}
              isDeleted={deletedEntityIds.has(entry.entity_id)}
              placeIconId={entry.entity_type === 'place' ? (placeIcons[entry.entity_id] ?? null) : null}
              onTap={() => onNavigateToEntity(entry.entity_type, entry.entity_id)}
            />
          ))}
        </div>
      ))}

      {loading && (
        <div className="activity-view__loading">
          <span className="activity-view__spinner" />
        </div>
      )}

      {isEmpty && (
        <div className="activity-view__empty">
          <p>{ui(hasFilters ? 'activity.empty_filtered' : 'activity.empty', language)}</p>
        </div>
      )}
    </div>
  )
}

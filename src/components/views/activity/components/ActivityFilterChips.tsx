import { X } from 'lucide-react'
import type { EntityTypeFilter, ActionFilter } from '../../../../hooks/useActivityFeed'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'

const ENTITY_FILTERS: { value: EntityTypeFilter; labelKey: string }[] = [
  { value: 'storage_entry', labelKey: 'activity.filter_objects' },
  { value: 'place', labelKey: 'activity.filter_places' },
]

const ACTION_FILTERS: { value: ActionFilter; labelKey: string }[] = [
  { value: 'add', labelKey: 'activity.filter_added' },
  { value: 'move', labelKey: 'activity.filter_moved' },
  { value: 'edit', labelKey: 'activity.filter_edited' },
  { value: 'delete', labelKey: 'activity.filter_deleted' },
]

interface ActivityFilterChipsProps {
  entityFilter: EntityTypeFilter
  actionFilter: ActionFilter
  onEntityFilterChange: (value: EntityTypeFilter) => void
  onActionFilterChange: (value: ActionFilter) => void
}

export function ActivityFilterChips({
  entityFilter,
  actionFilter,
  onEntityFilterChange,
  onActionFilterChange,
}: ActivityFilterChipsProps) {
  const { language } = useLanguage()

  return (
    <div className="activity-view__filters">
      <div className="activity-view__filter-row">
        <span className="activity-view__filter-label">{ui('activity.filter_type_label', language)}</span>
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`activity-view__chip ${entityFilter === f.value ? 'activity-view__chip--active' : ''}`}
            onClick={() => onEntityFilterChange(entityFilter === f.value ? 'all' : f.value)}
          >
            {ui(f.labelKey, language)}
          </button>
        ))}
        {entityFilter !== 'all' && (
          <button className="activity-view__filter-clear" onClick={() => onEntityFilterChange('all')} aria-label="Clear">
            <X size={12} />
          </button>
        )}
      </div>
      <div className="activity-view__filter-row">
        <span className="activity-view__filter-label">{ui('activity.filter_action_label', language)}</span>
        {ACTION_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`activity-view__chip ${actionFilter === f.value ? 'activity-view__chip--active' : ''}`}
            onClick={() => onActionFilterChange(actionFilter === f.value ? 'all' : f.value)}
          >
            {ui(f.labelKey, language)}
          </button>
        ))}
        {actionFilter !== 'all' && (
          <button className="activity-view__filter-clear" onClick={() => onActionFilterChange('all')} aria-label="Clear">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

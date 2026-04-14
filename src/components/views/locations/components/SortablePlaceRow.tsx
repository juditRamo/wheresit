import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical, MoreHorizontal } from 'lucide-react'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'
import { getPlaceIcon } from '../../../../lib/placeIcons'
import type { PlaceWithChildren } from '../../../../hooks/usePlaces'
import './SortablePlaceRow.css'

interface SortablePlaceRowProps {
  place: PlaceWithChildren
  itemCount: number
  onDrillIn: (id: string) => void
  onActions: (place: PlaceWithChildren) => void
}

export function SortablePlaceRow({ place, itemCount, onDrillIn, onActions }: SortablePlaceRowProps) {
  const { language } = useLanguage()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: place.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  const TypeIcon = getPlaceIcon(place.icon)
  const hasChildren = place.children.length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="locations-view__place-row"
      data-entity-id={place.id}
      onClick={() => onDrillIn(place.id)}
    >
      <button
        className="sortable-place-row__drag-handle"
        aria-label={ui('locations.drag_handle', language)}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={16} />
      </button>
      <span className="locations-view__type-icon">
        <TypeIcon size={18} color="var(--gold-primary)" />
      </span>
      <div className="locations-view__info">
        <div className="locations-view__info-text">
          <span className="locations-view__label locations-view__label--link">{place.label}</span>
          {itemCount > 0 && (
            <span className="locations-view__badge">
              {itemCount === 1 ? ui('inventory.item_one', language) : ui('inventory.item_other', language, { n: itemCount })}
            </span>
          )}
        </div>
      </div>
      {hasChildren && (
        <span className="locations-view__places-badge">
          {place.children.length}
          <ChevronRight size={12} />
        </span>
      )}
      <button
        className="locations-view__more-btn"
        onClick={(e) => {
          e.stopPropagation()
          onActions(place)
        }}
        aria-label="Actions"
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  )
}

/** Static version for DragOverlay (no sortable hooks). */
export function PlaceRowOverlay({ place, itemCount }: { place: PlaceWithChildren; itemCount: number }) {
  const { language } = useLanguage()
  const TypeIcon = getPlaceIcon(place.icon)
  const hasChildren = place.children.length > 0

  return (
    <div className="locations-view__place-row sortable-place-row--overlay">
      <span className="sortable-place-row__drag-handle">
        <GripVertical size={16} />
      </span>
      <span className="locations-view__type-icon">
        <TypeIcon size={18} color="var(--gold-primary)" />
      </span>
      <div className="locations-view__info">
        <div className="locations-view__info-text">
          <span className="locations-view__label locations-view__label--link">{place.label}</span>
          {itemCount > 0 && (
            <span className="locations-view__badge">
              {itemCount === 1 ? ui('inventory.item_one', language) : ui('inventory.item_other', language, { n: itemCount })}
            </span>
          )}
        </div>
      </div>
      {hasChildren && (
        <span className="locations-view__places-badge">
          {place.children.length}
          <ChevronRight size={12} />
        </span>
      )}
      <span className="locations-view__more-btn">
        <MoreHorizontal size={18} />
      </span>
    </div>
  )
}

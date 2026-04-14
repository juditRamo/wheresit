import { useState, useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { ui } from '../../i18n/ui'
import type { PlaceWithChildren } from '../../hooks/usePlaces'
import './PlaceDrillDown.css'

function flattenToMap(tree: PlaceWithChildren[]): Map<string, PlaceWithChildren> {
  const map = new Map<string, PlaceWithChildren>()
  function walk(nodes: PlaceWithChildren[]) {
    for (const n of nodes) {
      map.set(n.id, n)
      walk(n.children)
    }
  }
  walk(tree)
  return map
}

export interface PlaceDrillDownProps {
  placeTree: PlaceWithChildren[]
  onSelect: (placeId: string | null) => void
  excludeIds?: Set<string>
  showRootOption?: boolean
  emptyOptionLabel?: string
  /** Label for the "confirm current place" action, e.g. "Move here" or "Use this place" */
  confirmLabel: string
}

export function PlaceDrillDown({
  placeTree,
  onSelect,
  excludeIds = new Set(),
  showRootOption = false,
  emptyOptionLabel,
  confirmLabel,
}: PlaceDrillDownProps) {
  const { language } = useLanguage()
  const [path, setPath] = useState<string[]>([])

  const placeIdToPlace = useMemo(() => flattenToMap(placeTree), [placeTree])

  const currentPlace = path.length > 0 ? placeIdToPlace.get(path[path.length - 1]) : null
  const children = currentPlace?.children?.filter((p) => !excludeIds.has(p.id)) ?? []
  const roots = placeTree.filter((p) => !excludeIds.has(p.id))

  function handleBack() {
    setPath((prev) => prev.slice(0, -1))
  }

  function handleSelectPlace(id: string | null) {
    onSelect(id)
  }

  function handleDrillInto(place: PlaceWithChildren) {
    setPath((prev) => [...prev, place.id])
  }

  if (path.length === 0) {
    return (
      <div className="place-drill-down">
        <div className="place-drill-down__list">
          {showRootOption && (
            <button
              type="button"
              className="btn-ghost-gold place-drill-down__opt place-drill-down__opt--root"
              onClick={() => handleSelectPlace(null)}
            >
              {ui('places.root', language)}
            </button>
          )}
          {emptyOptionLabel && (
            <button
              type="button"
              className="btn-ghost-gold place-drill-down__opt"
              onClick={() => handleSelectPlace(null)}
            >
              {emptyOptionLabel}
            </button>
          )}
          {roots.map((p) => (
            <button
              key={p.id}
              type="button"
              className="btn-ghost-gold place-drill-down__opt"
              onClick={() => handleDrillInto(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="place-drill-down">
      <div className="place-drill-down__list">
        <button
          type="button"
          className="btn-secondary place-drill-down__opt place-drill-down__opt--back"
          onClick={handleBack}
        >
          <ChevronLeft size={14} />
          {ui('places.back', language)}
        </button>
        {currentPlace && (
          <button
            type="button"
            className="btn-ghost-gold place-drill-down__opt place-drill-down__opt--confirm"
            onClick={() => handleSelectPlace(currentPlace.id)}
          >
            {confirmLabel}: {currentPlace.label}
          </button>
        )}
        {children.map((p) => (
          <button
            key={p.id}
            type="button"
            className="btn-ghost-gold place-drill-down__opt"
            onClick={() => handleDrillInto(p)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

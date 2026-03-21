import { useState, useMemo } from 'react'
import { Check, ChevronLeft, ChevronRight, MoreHorizontal, Plus, X } from 'lucide-react'
import { usePlaces, type PlaceWithChildren } from '../hooks/usePlaces'
import { useStorageEntries } from '../hooks/useStorageEntries'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import { recordHistoryEvent } from '../lib/historyEvents'
import { getPlaceIcon } from '../lib/placeIcons'
import type { LocationRef } from '../types'
import { PlaceDrillDown } from './PlaceDrillDown'
import { PlaceEditSheet } from './PlaceEditSheet'
import { PlaceIconPicker } from './PlaceIconPicker'
import { LocationActionSheet } from './LocationActionSheet'
import './LocationsView.css'

interface LocationsViewProps {
  householdId: string
  onNavigateToItems?: (filter: LocationRef) => void
}

function flattenTree(tree: PlaceWithChildren[]): PlaceWithChildren[] {
  const out: PlaceWithChildren[] = []
  function walk(nodes: PlaceWithChildren[]) {
    for (const n of nodes) {
      out.push(n)
      walk(n.children)
    }
  }
  walk(tree)
  return out
}

export function LocationsView({ householdId, onNavigateToItems }: LocationsViewProps) {
  const { placeTree, loading, createPlace, updatePlace, movePlace, deletePlace, refetch, getPlacePath, getDescendantIds } = usePlaces(householdId)
  const { entries } = useStorageEntries(householdId)
  const { language } = useLanguage()

  // Drill-down navigation state
  const [path, setPath] = useState<string[]>([])
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

  // Action states
  const [adding, setAdding] = useState(false)
  const [newIcon, setNewIcon] = useState('map-pin')
  const [newLabel, setNewLabel] = useState('')
  const [editing, setEditing] = useState<PlaceWithChildren | null>(null)
  const [actionsPlace, setActionsPlace] = useState<PlaceWithChildren | null>(null)
  const [movePlace_, setMovePlace] = useState<PlaceWithChildren | null>(null)

  const allPlacesFlat = useMemo(() => flattenTree(placeTree), [placeTree])
  const placeIdToPlace = useMemo(() => new Map(allPlacesFlat.map((p) => [p.id, p])), [allPlacesFlat])
  const itemCountByPlace = (placeId: string) => entries.filter((e) => e.place_id === placeId).length

  // Current place and visible children
  const currentPlace = path.length > 0 ? placeIdToPlace.get(path[path.length - 1]) ?? null : null
  const visiblePlaces = currentPlace ? currentPlace.children : placeTree

  // Breadcrumb path
  const breadcrumbs = path.map((id) => placeIdToPlace.get(id)).filter(Boolean) as PlaceWithChildren[]

  // Clean up path if a place in the path was deleted
  const pathValid = path.every((id) => placeIdToPlace.has(id))
  if (!pathValid && path.length > 0) {
    // Find last valid ancestor
    const validPath: string[] = []
    for (const id of path) {
      if (placeIdToPlace.has(id)) validPath.push(id)
      else break
    }
    // Use setTimeout to avoid setState during render
    setTimeout(() => setPath(validPath), 0)
  }

  function drillIn(placeId: string) {
    setDirection('forward')
    setPath((prev) => [...prev, placeId])
    setAdding(false)
  }

  function goBack() {
    setDirection('back')
    setPath((prev) => prev.slice(0, -1))
    setAdding(false)
  }

  function goToLevel(index: number) {
    setDirection('back')
    setPath((prev) => prev.slice(0, index + 1))
    setAdding(false)
  }

  function goToRoot() {
    setDirection('back')
    setPath([])
    setAdding(false)
  }

  async function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    const parentId = currentPlace?.id ?? null
    const { data: created, error } = await createPlace({
      icon: newIcon,
      label,
      ...(parentId ? { parent_place_id: parentId } : {}),
    })
    if (!error && created) {
      recordHistoryEvent(householdId, 'add_place', 'place', created.id, {
        label: created.label,
        icon: created.icon,
        ...(parentId ? { parent_place_id: parentId } : {}),
        canonical_key: created.canonical_key ?? undefined,
      })
      setNewLabel('')
      setNewIcon('map-pin')
      setAdding(false)
      refetch()
    }
  }

  async function handleSaveEdit(data: { label: string; icon: string; attributes: Record<string, string> }) {
    if (!editing) return
    const err = await updatePlace(editing.id, { label: data.label, icon: data.icon, attributes: data.attributes })
    if (!err?.error) {
      recordHistoryEvent(householdId, 'edit_place', 'place', editing.id, {
        label: data.label,
        changes: { label: data.label, icon: data.icon, attributes: data.attributes },
      })
    }
    setEditing(null)
    refetch()
  }

  async function handleDelete(p: PlaceWithChildren) {
    if (!window.confirm(ui('locations.delete_confirm', language))) return
    const pathDesc = getPlacePath(p.id).map((x) => x.label).join(' › ')
    recordHistoryEvent(householdId, 'delete_place', 'place', p.id, {
      label: p.label,
      path_or_description: pathDesc || undefined,
    })
    await deletePlace(p.id)
    refetch()
  }

  async function handleMove(p: PlaceWithChildren, newParentId: string | null) {
    const err = await movePlace(p.id, newParentId)
    if (!err?.error) {
      recordHistoryEvent(householdId, 'move_place', 'place', p.id, {
        label: p.label,
        from_parent_place_id: p.parent_place_id ?? undefined,
        to_parent_place_id: newParentId ?? undefined,
      })
    }
    setMovePlace(null)
    refetch()
  }

  async function handleDuplicate(p: PlaceWithChildren) {
    const label = p.label.trim() ? `${p.label} (copy)` : '(copy)'
    const { data: created, error } = await createPlace({
      icon: p.icon,
      label,
      parent_place_id: p.parent_place_id ?? null,
      attributes: p.attributes ?? {},
    })
    if (!error && created) {
      recordHistoryEvent(householdId, 'add_place', 'place', created.id, {
        label: created.label,
        icon: created.icon,
        canonical_key: created.canonical_key ?? undefined,
        duplicated_from_place_id: p.id,
      })
      refetch()
    }
  }

  const isRoot = path.length === 0
  const animationKey = currentPlace?.id ?? 'root'

  return (
    <div className="locations-view">
      {/* Header: root or drilled-in nav */}
      {isRoot ? (
        <div className="locations-view__header">
          <h1 className="locations-view__title">{ui('locations.tab_title', language)}</h1>
          <button className="locations-view__add-btn" onClick={() => { setAdding(true); setNewIcon('map-pin'); setNewLabel('') }}>
            <Plus size={16} />
            {ui('locations.add_place', language)}
          </button>
        </div>
      ) : (
        <>
        <div className="locations-view__nav">
          <button className="locations-view__back-btn" onClick={goBack}>
            <ChevronLeft size={14} />
            <span>{path.length > 1 ? breadcrumbs[breadcrumbs.length - 2]?.label : ui('locations.tab_title', language)}</span>
          </button>
        </div>
        <div className="locations-view__nav-title">
          <span className="locations-view__nav-title-icon">
            {(() => { const Icon = getPlaceIcon(currentPlace!.icon); return <Icon size={20} color="var(--gold-primary)" />; })()}
          </span>
          <h1 className="locations-view__nav-title-text">{currentPlace!.label}</h1>
          <button
            className="locations-view__more-btn"
            onClick={() => currentPlace && setActionsPlace(currentPlace)}
            aria-label="Actions"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
        </>
      )}

      {/* Breadcrumbs (when deeper than 1 level) */}
      {path.length > 1 && (
        <div className="locations-view__breadcrumbs">
          <button className="locations-view__breadcrumb-segment" onClick={goToRoot}>
            {ui('locations.tab_title', language)}
          </button>
          {breadcrumbs.map((place, i) => (
            <span key={place.id} className="locations-view__breadcrumb-item">
              <span className="locations-view__breadcrumb-sep">›</span>
              {i < breadcrumbs.length - 1 ? (
                <button className="locations-view__breadcrumb-segment" onClick={() => goToLevel(i)}>
                  {place.label}
                </button>
              ) : (
                <span className="locations-view__breadcrumb-current">{place.label}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="locations-view__form">
          <PlaceIconPicker selected={newIcon} onSelect={setNewIcon} compact />
          <input
            className="locations-view__input"
            placeholder={ui('locations.name_placeholder', language)}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <button className="locations-view__submit" onClick={handleAdd}>
            <Check size={18} />
            <span className="locations-view__btn-label">{ui('edit.save', language)}</span>
          </button>
          <button className="locations-view__cancel" onClick={() => setAdding(false)}>
            <X size={18} />
            <span className="locations-view__btn-label">{ui('edit.cancel', language)}</span>
          </button>
        </div>
      )}

      {/* Edit sheet */}
      {editing && (
        <PlaceEditSheet
          place={editing}
          onSave={handleSaveEdit}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Action sheet */}
      {actionsPlace && (
        <LocationActionSheet
          place={actionsPlace}
          onAddChild={() => {
            const place = actionsPlace
            setActionsPlace(null)
            // If action is on a child row (not the current place), drill into it first
            if (place.id !== currentPlace?.id) {
              drillIn(place.id)
            }
            setAdding(true)
            setNewIcon('map-pin')
            setNewLabel('')
          }}
          onEdit={() => { const p = actionsPlace; setActionsPlace(null); setEditing(p) }}
          onDuplicate={() => { const p = actionsPlace; setActionsPlace(null); handleDuplicate(p) }}
          onMove={() => { const p = actionsPlace; setActionsPlace(null); setMovePlace(p) }}
          onDelete={() => { const p = actionsPlace; setActionsPlace(null); handleDelete(p) }}
          onClose={() => setActionsPlace(null)}
        />
      )}

      {/* Move panel */}
      {movePlace_ && (
        <div className="locations-view__move-overlay">
          <div className="locations-view__move-panel">
            <span className="locations-view__move-panel-label">{ui('locations.move_to_title', language)}: {movePlace_.label}</span>
            <PlaceDrillDown
              placeTree={placeTree}
              onSelect={(newParentId) => handleMove(movePlace_, newParentId)}
              excludeIds={new Set([movePlace_.id, ...getDescendantIds(movePlace_.id)])}
              showRootOption
              confirmLabel={ui('places.move_here', language)}
            />
            <button className="locations-view__cancel" onClick={() => setMovePlace(null)}>
              {ui('edit.cancel', language)}
            </button>
          </div>
        </div>
      )}

      {/* Body: place list */}
      <div className="locations-view__body">
        {loading && placeTree.length === 0 ? (
          <p className="locations-view__empty">Loading…</p>
        ) : visiblePlaces.length === 0 ? (
          <div className="locations-view__empty-state">
            <p className="locations-view__empty">
              {isRoot
                ? ui('locations.empty', language)
                : ui('locations.no_children', language, { name: currentPlace?.label ?? '' })}
            </p>
            {!isRoot && !adding && (
              <button
                className="locations-view__add-btn"
                onClick={() => { setAdding(true); setNewIcon('map-pin'); setNewLabel('') }}
              >
                <Plus size={16} />
                {ui('locations.add_inside', language, { name: currentPlace?.label ?? '' })}
              </button>
            )}
          </div>
        ) : (
          <div
            key={animationKey}
            className={`locations-view__animate ${direction === 'forward' ? 'locations-view__animate-forward' : 'locations-view__animate-back'}`}
          >
            <div className="locations-view__place-list">
              {visiblePlaces.map((place) => {
                const TypeIcon = getPlaceIcon(place.icon)
                const count = itemCountByPlace(place.id)
                const hasChildren = place.children.length > 0

                return (
                  <div
                    key={place.id}
                    className="locations-view__place-row"
                    onClick={() => hasChildren ? drillIn(place.id) : undefined}
                  >
                    <span className="locations-view__type-icon">
                      <TypeIcon size={18} color="var(--gold-primary)" />
                    </span>
                    <div className="locations-view__info">
                      <div className="locations-view__info-text">
                        {onNavigateToItems ? (
                          <button
                            type="button"
                            className="locations-view__label locations-view__label--link"
                            onClick={(e) => {
                              e.stopPropagation()
                              onNavigateToItems({ place_id: place.id, place_label: place.label })
                            }}
                          >
                            {place.label}
                          </button>
                        ) : (
                          <span className="locations-view__label">{place.label}</span>
                        )}
                        {count > 0 && (
                          <span className="locations-view__badge">
                            {count === 1 ? ui('inventory.item_one', language) : ui('inventory.item_other', language, { n: count })}
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
                        setActionsPlace(place)
                      }}
                      aria-label="Actions"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Add inside button (when drilled in and not already adding) */}
            {!isRoot && !adding && (
              <button
                className="locations-view__add-inside-btn"
                onClick={() => { setAdding(true); setNewIcon('map-pin'); setNewLabel('') }}
              >
                <Plus size={14} />
                {ui('locations.add_inside', language, { name: currentPlace?.label ?? '' })}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

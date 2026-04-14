import { useState, useMemo, useEffect, useRef } from 'react'
import { useBackHandler } from '../../../hooks/useBackHandler'
import { pushHandler, removeHandler } from '../../../lib/backNavigation'
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Check, ChevronLeft, MoreHorizontal, Package, Plus, X } from 'lucide-react'
import { usePlaces, type PlaceWithChildren } from '../../../hooks/usePlaces'
import { useStorageEntries } from '../../../hooks/useStorageEntries'
import { useLanguage } from '../../../i18n/LanguageContext'
import { ui } from '../../../i18n/ui'
import { recordHistoryEvent } from '../../../lib/historyEvents'
import { getPlaceIcon } from '../../../lib/placeIcons'
import type { LocationRef, HistoryEntityType } from '../../../types'
import { PlaceDrillDown } from '../../pickers/PlaceDrillDown'
import { PlaceIconPicker } from '../../pickers/PlaceIconPicker'
import { ItemEditSheet } from '../../sheets/ItemEditSheet'
import { PlaceEditSheet } from '../../sheets/PlaceEditSheet'
import { LocationActionSheet } from './components/LocationActionSheet'
import { SortablePlaceRow, PlaceRowOverlay } from './components/SortablePlaceRow'
import './LocationsView.css'

interface LocationsViewProps {
  householdId: string
  onNavigateToItems?: (filter: LocationRef) => void
  highlightEntity?: { type: HistoryEntityType; id: string } | null
  onClearHighlight?: () => void
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

export function LocationsView({ householdId, onNavigateToItems, highlightEntity, onClearHighlight }: LocationsViewProps) {
  const { placeTree, loading, createPlace, updatePlace, movePlace, deletePlace, reorderPlaces, refetch, getPlacePath, getDescendantIds } = usePlaces(householdId)
  const { entries, refetch: refetchEntries } = useStorageEntries(householdId)
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
  const [addingItemAtPlace, setAddingItemAtPlace] = useState<PlaceWithChildren | null>(null)
  const [editingItem, setEditingItem] = useState<import('../../../types').StorageEntry | null>(null)

  // Drag-and-drop
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const allPlacesFlat = useMemo(() => flattenTree(placeTree), [placeTree])
  const placeIdToPlace = useMemo(() => new Map(allPlacesFlat.map((p) => [p.id, p])), [allPlacesFlat])
  const itemCountByPlace = (placeId: string) => entries.filter((e) => e.place_id === placeId).length

  // Scroll to and highlight place when navigated from Activity tab
  useEffect(() => {
    if (!highlightEntity || highlightEntity.type !== 'place') return
    const el = document.querySelector(`[data-entity-id="${highlightEntity.id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('locations__place--highlight')
      const timer = setTimeout(() => {
        el.classList.remove('locations__place--highlight')
        onClearHighlight?.()
      }, 2000)
      return () => clearTimeout(timer)
    }
    onClearHighlight?.()
  }, [highlightEntity, onClearHighlight])

  // Current place and visible children
  const currentPlace = path.length > 0 ? placeIdToPlace.get(path[path.length - 1]) ?? null : null
  const visiblePlaces = currentPlace ? currentPlace.children : placeTree

  // Breadcrumb path
  const breadcrumbs = path.map((id) => placeIdToPlace.get(id)).filter(Boolean) as PlaceWithChildren[]

  // Clean up path if a place in the path was deleted
  const pathValid = path.every((id) => placeIdToPlace.has(id))
  if (!pathValid && path.length > 0) {
    const validPath: string[] = []
    for (const id of path) {
      if (placeIdToPlace.has(id)) validPath.push(id)
      else break
    }
    setTimeout(() => setPath(validPath), 0)
  }

  // Back-button handling for drill-down navigation
  const drillHandlerIdsRef = useRef<string[]>([])
  const fromPopstateRef = useRef(false)
  const prevPathLenRef = useRef(0)

  useEffect(() => {
    const prevLen = prevPathLenRef.current
    const currLen = path.length
    prevPathLenRef.current = currLen

    if (currLen > prevLen) {
      for (let i = prevLen; i < currLen; i++) {
        const id = `drill-${path[i]}-${Date.now()}-${i}`
        drillHandlerIdsRef.current.push(id)
        pushHandler(id, () => {
          fromPopstateRef.current = true
          setDirection('back')
          setPath((prev) => prev.slice(0, -1))
          setAdding(false)
        })
      }
    } else if (currLen < prevLen) {
      const countToRemove = prevLen - currLen
      if (fromPopstateRef.current) {
        fromPopstateRef.current = false
        const extras = drillHandlerIdsRef.current.splice(currLen)
        for (let i = 1; i < extras.length; i++) {
          removeHandler(extras[i])
        }
      } else {
        const extras = drillHandlerIdsRef.current.splice(currLen, countToRemove)
        for (const id of extras) {
          removeHandler(id)
        }
      }
    }
  }, [path])

  useEffect(() => {
    return () => {
      for (const id of drillHandlerIdsRef.current) {
        removeHandler(id)
      }
      drillHandlerIdsRef.current = []
    }
  }, [])

  // Back handlers for modals/sheets
  useBackHandler(!!actionsPlace, () => setActionsPlace(null))
  useBackHandler(!!editing, () => setEditing(null))
  useBackHandler(!!movePlace_, () => setMovePlace(null))
  useBackHandler(!!(addingItemAtPlace || editingItem), () => { setAddingItemAtPlace(null); setEditingItem(null) })

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
      const changes: Record<string, { from: unknown; to: unknown }> = {}
      if (editing.label !== data.label) {
        changes[ui('activity.field_name', language)] = { from: editing.label, to: data.label }
      }
      if (editing.icon !== data.icon) {
        changes[ui('activity.field_icon', language)] = { from: editing.icon, to: data.icon }
      }
      recordHistoryEvent(householdId, 'edit_place', 'place', editing.id, {
        label: data.label,
        changes,
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

  // Items at the currently drilled-in place (direct, not descendants)
  const currentPlaceItems = useMemo(() => {
    if (!currentPlace) return []
    return entries.filter((e) => e.place_id === currentPlace.id)
  }, [entries, currentPlace])

  const isRoot = path.length === 0
  const animationKey = currentPlace?.id ?? 'root'

  const activeDragPlace = activeDragId ? placeIdToPlace.get(activeDragId) ?? null : null
  const sortableIds = useMemo(() => visiblePlaces.map((p) => p.id), [visiblePlaces])

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = visiblePlaces.findIndex((p) => p.id === active.id)
    const newIndex = visiblePlaces.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(visiblePlaces, oldIndex, newIndex)
    reorderPlaces(reordered.map((p) => p.id))
  }

  return (
    <div className="locations-view">
      {/* Header: root or drilled-in nav */}
      {isRoot ? (
        <div className="locations-view__header">
          <h1 className="locations-view__title">{ui('locations.tab_title', language)}</h1>
          <button className="btn-ghost-gold locations-view__add-btn" onClick={() => { setAdding(true); setNewIcon('map-pin'); setNewLabel('') }}>
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
            className="input-field locations-view__input"
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
          onAddItem={() => { const p = actionsPlace; setActionsPlace(null); setAddingItemAtPlace(p) }}
          onAddChild={() => {
            const place = actionsPlace
            setActionsPlace(null)
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

      {/* Item edit/add sheet */}
      {(addingItemAtPlace || editingItem) && (
        <ItemEditSheet
          mode={editingItem ? 'edit' : 'create'}
          entry={editingItem}
          householdId={householdId}
          initialPlaceId={addingItemAtPlace?.id}
          onSaved={() => { refetchEntries(); setEditingItem(null); setAddingItemAtPlace(null) }}
          onDeleted={() => { refetchEntries(); setEditingItem(null) }}
          onClose={() => { setAddingItemAtPlace(null); setEditingItem(null) }}
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

      {/* Body */}
      <div className="locations-view__body">
        {loading && placeTree.length === 0 ? (
          <p className="locations-view__empty">{ui('common.loading', language)}</p>
        ) : isRoot ? (
          visiblePlaces.length === 0 ? (
            <div className="locations-view__empty-state">
              <p className="locations-view__empty">{ui('locations.empty', language)}</p>
            </div>
          ) : (
            <div
              key={animationKey}
              className={`locations-view__animate ${direction === 'forward' ? 'locations-view__animate-forward' : 'locations-view__animate-back'}`}
            >
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <div className="locations-view__place-list">
                    {visiblePlaces.map((place) => (
                      <SortablePlaceRow
                        key={place.id}
                        place={place}
                        itemCount={itemCountByPlace(place.id)}
                        onDrillIn={drillIn}
                        onActions={setActionsPlace}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeDragPlace && (
                    <PlaceRowOverlay place={activeDragPlace} itemCount={itemCountByPlace(activeDragPlace.id)} />
                  )}
                </DragOverlay>
              </DndContext>
            </div>
          )
        ) : (
          <div
            key={animationKey}
            className={`locations-view__animate ${direction === 'forward' ? 'locations-view__animate-forward' : 'locations-view__animate-back'}`}
          >
            {/* ── Places section ── */}
            <div className="locations-view__section-title">{ui('locations.section_places', language)}</div>
            {visiblePlaces.length > 0 ? (
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <div className="locations-view__place-list">
                    {visiblePlaces.map((place) => (
                      <SortablePlaceRow
                        key={place.id}
                        place={place}
                        itemCount={itemCountByPlace(place.id)}
                        onDrillIn={drillIn}
                        onActions={setActionsPlace}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeDragPlace && (
                    <PlaceRowOverlay place={activeDragPlace} itemCount={itemCountByPlace(activeDragPlace.id)} />
                  )}
                </DragOverlay>
              </DndContext>
            ) : (
              <p className="locations-view__empty locations-view__empty--sm">
                {ui('locations.no_children', language, { name: currentPlace?.label ?? '' })}
              </p>
            )}
            {!adding && (
              <button
                className="locations-view__add-inside-btn"
                onClick={() => { setAdding(true); setNewIcon('map-pin'); setNewLabel('') }}
              >
                <Plus size={14} />
                {ui('locations.add_inside', language, { name: currentPlace?.label ?? '' })}
              </button>
            )}

            {/* ── Items section ── */}
            <div className="locations-view__section-title">{ui('locations.section_items', language)}</div>
            {currentPlaceItems.length > 0 ? (
              <div className="locations-view__items-list">
                {currentPlaceItems.map((item) => (
                  <button
                    key={item.id}
                    className="locations-view__items-row"
                    onClick={() => setEditingItem(item)}
                  >
                    <Package size={14} />
                    <span className="locations-view__items-name">{item.item_name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="locations-view__empty locations-view__empty--sm">
                {ui('locations.no_items', language, { name: currentPlace?.label ?? '' })}
              </p>
            )}
            <button
              className="locations-view__add-inside-btn"
              onClick={() => currentPlace && setAddingItemAtPlace(currentPlace)}
            >
              <Package size={14} />
              {ui('locations.add_item_here', language)}
            </button>
            {currentPlaceItems.length > 10 && onNavigateToItems && (
              <button
                className="locations-view__items-viewall"
                onClick={() => onNavigateToItems({ place_id: currentPlace!.id, place_label: currentPlace!.label })}
              >
                {ui('locations.view_all_items', language)} →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

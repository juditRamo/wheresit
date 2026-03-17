import { useState } from 'react'
import { ChevronRight, MoreHorizontal, Plus } from 'lucide-react'
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

function PlaceNode({
  place,
  depth,
  allPlaces,
  placeTree,
  itemCount,
  placeIdToPlace,
  getPlacePath,
  getDescendantIds,
  onEdit,
  onDuplicate,
  onDelete,
  onMove,
  onNavigateToItems,
  addingUnderId,
  newIcon,
  newLabel,
  setNewIcon,
  setNewLabel,
  onAddChild,
  onCancelAddChild,
  onAddChildSubmit,
}: {
  place: PlaceWithChildren
  depth: number
  allPlaces: PlaceWithChildren[]
  placeTree: PlaceWithChildren[]
  itemCount: (placeId: string) => number
  placeIdToPlace: Map<string, PlaceWithChildren>
  getPlacePath: (placeId: string) => Array<{ label: string }>
  getDescendantIds: (placeId: string) => string[]
  onEdit: (p: PlaceWithChildren) => void
  onDuplicate: (p: PlaceWithChildren) => void
  onDelete: (p: PlaceWithChildren) => void
  onMove: (p: PlaceWithChildren, newParentId: string | null) => void
  onNavigateToItems?: (filter: LocationRef) => void
  addingUnderId: string | null
  newIcon: string
  newLabel: string
  setNewIcon: (i: string) => void
  setNewLabel: (l: string) => void
  onAddChild: (p: PlaceWithChildren) => void
  onCancelAddChild: () => void
  onAddChildSubmit: (parentId: string) => void
}) {
  const { language } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const [showMove, setShowMove] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const count = itemCount(place.id) + place.children.reduce((s, c) => s + itemCount(c.id), 0)
  const excludeIds = new Set([place.id, ...getDescendantIds(place.id)])
  const TypeIcon = getPlaceIcon(place.icon)
  const showChildForm = addingUnderId === place.id

  return (
    <div className="locations-view__node" style={{ paddingLeft: Math.min(depth * 16, 48) }}>
      <div
        className="locations-view__row"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="locations-view__expand" aria-label={collapsed ? 'Expand' : 'Collapse'}>
          <ChevronRight
            size={14}
            className={`locations-view__chevron ${!collapsed ? 'locations-view__chevron--open' : ''}`}
          />
        </span>
        <div className="locations-view__info">
          <span className="locations-view__type-icon">
            <TypeIcon size={16} color="var(--gold-primary)" />
          </span>
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
            <span className="locations-view__meta">
              {count > 0 && <>{count === 1 ? ui('inventory.item_one', language) : ui('inventory.item_other', language, { n: count })}</>}
            </span>
          </div>
        </div>
        <button
          className="locations-view__more-btn"
          onClick={(e) => {
            e.stopPropagation()
            setShowActions(true)
          }}
          aria-label="Actions"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {showActions && (
        <LocationActionSheet
          place={place}
          onAddChild={() => { setShowActions(false); onAddChild(place) }}
          onEdit={() => { setShowActions(false); onEdit(place) }}
          onDuplicate={() => { setShowActions(false); onDuplicate(place) }}
          onMove={() => { setShowActions(false); setShowMove(true) }}
          onDelete={() => { setShowActions(false); onDelete(place) }}
          onClose={() => setShowActions(false)}
        />
      )}
      {showChildForm && (
        <div className="locations-view__form locations-view__form--inline">
          <PlaceIconPicker selected={newIcon} onSelect={setNewIcon} compact />
          <input
            className="locations-view__input"
            placeholder={ui('locations.name_placeholder', language)}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddChildSubmit(place.id)}
          />
          <button className="locations-view__submit" onClick={() => onAddChildSubmit(place.id)}>
            {ui('edit.save', language)}
          </button>
          <button className="locations-view__cancel" onClick={onCancelAddChild}>
            {ui('edit.cancel', language)}
          </button>
        </div>
      )}
      {showMove && (
        <div className="locations-view__move-panel">
          <span className="locations-view__move-panel-label">{ui('locations.move_to_title', language)}</span>
          <PlaceDrillDown
            placeTree={placeTree}
            onSelect={(newParentId) => {
              onMove(place, newParentId)
              setShowMove(false)
            }}
            excludeIds={excludeIds}
            showRootOption
            confirmLabel={ui('places.move_here', language)}
          />
        </div>
      )}
      {!collapsed && place.children.length > 0 && (
        <div className="locations-view__children">
          {place.children.map((child) => (
            <PlaceNode
              key={child.id}
              place={child}
              depth={depth + 1}
              allPlaces={allPlaces}
              placeTree={placeTree}
              itemCount={itemCount}
              placeIdToPlace={placeIdToPlace}
              getPlacePath={getPlacePath}
              getDescendantIds={getDescendantIds}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onMove={onMove}
              onNavigateToItems={onNavigateToItems}
              addingUnderId={addingUnderId}
              newIcon={newIcon}
              newLabel={newLabel}
              setNewIcon={setNewIcon}
              setNewLabel={setNewLabel}
              onAddChild={onAddChild}
              onCancelAddChild={onCancelAddChild}
              onAddChildSubmit={onAddChildSubmit}
            />
          ))}
        </div>
      )}
    </div>
  )
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
  const [adding, setAdding] = useState(false)
  const [addingUnderId, setAddingUnderId] = useState<string | null>(null)
  const [newIcon, setNewIcon] = useState('map-pin')
  const [newLabel, setNewLabel] = useState('')
  const [editing, setEditing] = useState<PlaceWithChildren | null>(null)

  const itemCountByPlace = (placeId: string) => entries.filter((e) => e.place_id === placeId).length
  const allPlacesFlat = flattenTree(placeTree)
  const placeIdToPlace = new Map(allPlacesFlat.map((p) => [p.id, p]))

  async function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    const { data: created, error } = await createPlace({ icon: newIcon, label })
    if (!error && created) {
      recordHistoryEvent(householdId, 'add_place', 'place', created.id, {
        label: created.label,
        icon: created.icon,
        canonical_key: created.canonical_key ?? undefined,
      })
      setNewLabel('')
      setAdding(false)
      refetch()
    }
  }

  function startAddChild(place: PlaceWithChildren) {
    setAddingUnderId(place.id)
    setNewIcon('map-pin')
    setNewLabel('')
  }

  function cancelAddChild() {
    setAddingUnderId(null)
  }

  async function handleAddChild(parentId: string) {
    const label = newLabel.trim()
    if (!label) return
    const { data: created, error } = await createPlace({ icon: newIcon, label, parent_place_id: parentId })
    if (!error && created) {
      recordHistoryEvent(householdId, 'add_place', 'place', created.id, {
        label: created.label,
        icon: created.icon,
        parent_place_id: parentId,
        canonical_key: created.canonical_key ?? undefined,
      })
      setNewLabel('')
      setAddingUnderId(null)
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

  return (
    <div className="locations-view">
      <div className="locations-view__header">
        <h1 className="locations-view__title">{ui('locations.tab_title', language)}</h1>
        <button className="locations-view__add-btn" onClick={() => setAdding(true)}>
          <Plus size={16} />
          {ui('locations.add_place', language)}
        </button>
      </div>
      {adding && !addingUnderId && (
        <div className="locations-view__form">
          <PlaceIconPicker selected={newIcon} onSelect={setNewIcon} compact />
          <input
            className="locations-view__input"
            placeholder={ui('locations.name_placeholder', language)}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="locations-view__submit" onClick={handleAdd}>
            {ui('edit.save', language)}
          </button>
          <button className="locations-view__cancel" onClick={() => setAdding(false)}>
            {ui('edit.cancel', language)}
          </button>
        </div>
      )}
      {editing && (
        <PlaceEditSheet
          place={editing}
          onSave={handleSaveEdit}
          onClose={() => setEditing(null)}
        />
      )}
      <div className="locations-view__body">
        {loading && placeTree.length === 0 ? (
          <p className="locations-view__empty">Loading…</p>
        ) : placeTree.length === 0 ? (
          <p className="locations-view__empty">{ui('locations.empty', language)}</p>
        ) : (
          <div className="locations-view__tree">
            {placeTree.map((place) => (
              <PlaceNode
                key={place.id}
                place={place}
                depth={0}
                allPlaces={allPlacesFlat}
                placeTree={placeTree}
                itemCount={itemCountByPlace}
                placeIdToPlace={placeIdToPlace}
                getPlacePath={getPlacePath}
                getDescendantIds={getDescendantIds}
                onEdit={(p) => setEditing(p)}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onMove={handleMove}
                onNavigateToItems={onNavigateToItems}
                addingUnderId={addingUnderId}
                newIcon={newIcon}
                newLabel={newLabel}
                setNewIcon={setNewIcon}
                setNewLabel={setNewLabel}
                onAddChild={startAddChild}
                onCancelAddChild={cancelAddChild}
                onAddChildSubmit={handleAddChild}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

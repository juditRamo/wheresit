import { useState } from 'react'
import { ChevronRight, Plus, Pencil, Trash2, MapPinPen, ToolCase, Inbox, DoorOpen, DoorClosed, LibraryBig, Folder, MapPin } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { usePlaces, type PlaceWithChildren } from '../hooks/usePlaces'
import { useStorageEntries } from '../hooks/useStorageEntries'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import type { LocationRef } from '../types'
import { PlaceDrillDown } from './PlaceDrillDown'
import { PlaceEditSheet } from './PlaceEditSheet'
import './LocationsView.css'

const PLACE_TYPE_ICONS: Record<string, LucideIcon> = {
  room: DoorOpen,
  furniture: DoorClosed,
  shelf: LibraryBig,
  drawer: Inbox,
  box: ToolCase,
  folder: Folder,
}

function getPlaceTypeIcon(type: string): LucideIcon {
  const icon = PLACE_TYPE_ICONS[type.toLowerCase()]
  return icon ?? MapPin
}

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
  onDelete,
  onMove,
  onNavigateToItems,
  addingUnderId,
  newType,
  newLabel,
  setNewType,
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
  onDelete: (p: PlaceWithChildren) => void
  onMove: (p: PlaceWithChildren, newParentId: string | null) => void
  onNavigateToItems?: (filter: LocationRef) => void
  addingUnderId: string | null
  newType: string
  newLabel: string
  setNewType: (t: string) => void
  setNewLabel: (l: string) => void
  onAddChild: (p: PlaceWithChildren) => void
  onCancelAddChild: () => void
  onAddChildSubmit: (parentId: string) => void
}) {
  const { language } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const [showMove, setShowMove] = useState(false)
  const count = itemCount(place.id) + place.children.reduce((s, c) => s + itemCount(c.id), 0)
  const excludeIds = new Set([place.id, ...getDescendantIds(place.id)])
  const TypeIcon = getPlaceTypeIcon(place.type)
  const showChildForm = addingUnderId === place.id

  return (
    <div className="locations-view__node" style={{ paddingLeft: depth * 16 }}>
      <div className="locations-view__row">
        <button
          className="locations-view__expand"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronRight
            size={14}
            className={`locations-view__chevron ${!collapsed ? 'locations-view__chevron--open' : ''}`}
          />
        </button>
        <div className="locations-view__info">
          <span className="locations-view__type-icon">
            <TypeIcon size={16} color="var(--gold-primary)" />
          </span>
          <div className="locations-view__info-text">
            {onNavigateToItems ? (
              <button
                type="button"
                className="locations-view__label locations-view__label--link"
                onClick={() => onNavigateToItems({ place_id: place.id, place_label: place.label })}
              >
                {place.label}
              </button>
            ) : (
              <span className="locations-view__label">{place.label}</span>
            )}
            <span className="locations-view__meta">
            {place.type}
            {Object.keys(place.attributes ?? {}).length > 0 && (
              <> · {Object.entries(place.attributes ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ')}</>
            )}
            {count > 0 && <> · {count} items</>}
            </span>
          </div>
        </div>
        <div className="locations-view__actions">
          <button
            className="locations-view__action"
            onClick={() => onAddChild(place)}
            title={ui('locations.add_child', language)}
          >
            <Plus size={12} />
          </button>
          <button
            className="locations-view__action"
            onClick={() => setShowMove(!showMove)}
            title={ui('locations.move_to', language)}
          >
            <MapPinPen size={14} />
          </button>
          <button className="locations-view__action" onClick={() => onEdit(place)} title={ui('locations.edit', language)}>
            <Pencil size={12} />
          </button>
          <button className="locations-view__action locations-view__action--danger" onClick={() => onDelete(place)} title={ui('locations.delete', language)}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {showChildForm && (
        <div className="locations-view__form locations-view__form--inline">
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="locations-view__select">
            <option value="room">Room</option>
            <option value="furniture">Furniture</option>
            <option value="shelf">Shelf</option>
            <option value="drawer">Drawer</option>
            <option value="box">Box</option>
            <option value="folder">Folder</option>
          </select>
          <input
            className="locations-view__input"
            placeholder="Label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddChildSubmit(place.id)}
          />
          <button className="locations-view__submit" onClick={() => onAddChildSubmit(place.id)}>
            Add
          </button>
          <button className="locations-view__cancel" onClick={onCancelAddChild}>
            Cancel
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
              onDelete={onDelete}
              onMove={onMove}
              onNavigateToItems={onNavigateToItems}
              addingUnderId={addingUnderId}
              newType={newType}
              newLabel={newLabel}
              setNewType={setNewType}
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
  const [newType, setNewType] = useState('room')
  const [newLabel, setNewLabel] = useState('')
  const [editing, setEditing] = useState<PlaceWithChildren | null>(null)

  const itemCountByPlace = (placeId: string) => entries.filter((e) => e.place_id === placeId).length
  const allPlacesFlat = flattenTree(placeTree)
  const placeIdToPlace = new Map(allPlacesFlat.map((p) => [p.id, p]))

  async function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    const { error } = await createPlace({ type: newType, label })
    if (!error) {
      setNewLabel('')
      setAdding(false)
      refetch()
    }
  }

  function startAddChild(place: PlaceWithChildren) {
    setAddingUnderId(place.id)
    setNewType('room')
    setNewLabel('')
  }

  function cancelAddChild() {
    setAddingUnderId(null)
  }

  async function handleAddChild(parentId: string) {
    const label = newLabel.trim()
    if (!label) return
    const { error } = await createPlace({ type: newType, label, parent_place_id: parentId })
    if (!error) {
      setNewLabel('')
      setAddingUnderId(null)
      refetch()
    }
  }

  async function handleSaveEdit(data: { label: string; type: string; attributes: Record<string, string> }) {
    if (!editing) return
    await updatePlace(editing.id, { label: data.label, type: data.type, attributes: data.attributes })
    setEditing(null)
    refetch()
  }

  async function handleDelete(p: PlaceWithChildren) {
    if (!window.confirm(ui('locations.delete_confirm', language))) return
    await deletePlace(p.id)
    refetch()
  }

  async function handleMove(p: PlaceWithChildren, newParentId: string | null) {
    await movePlace(p.id, newParentId)
    refetch()
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
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="locations-view__select">
            <option value="room">Room</option>
            <option value="furniture">Furniture</option>
            <option value="shelf">Shelf</option>
            <option value="drawer">Drawer</option>
            <option value="box">Box</option>
            <option value="folder">Folder</option>
          </select>
          <input
            className="locations-view__input"
            placeholder="Label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="locations-view__submit" onClick={handleAdd}>
            Add
          </button>
          <button className="locations-view__cancel" onClick={() => setAdding(false)}>
            Cancel
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
                onDelete={handleDelete}
                onMove={handleMove}
                onNavigateToItems={onNavigateToItems}
                addingUnderId={addingUnderId}
                newType={newType}
                newLabel={newLabel}
                setNewType={setNewType}
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

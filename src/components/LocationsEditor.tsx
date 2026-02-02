import { useState, useCallback, type DragEvent } from 'react'
import { ArrowLeft, ChevronRight, Plus, GripVertical, Pencil, Trash2, Check, X } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import { ROOMS, SPOTS, t } from '../i18n/picklists'
import type { Lang } from '../i18n/picklists'
import type { HouseholdTag } from '../types'
import './LocationsEditor.css'

interface LocationsEditorProps {
  tags: HouseholdTag[]
  onSaveTag: (tag: { tag_type: string; tag_key: string; label: string; parent_room_key?: string | null }) => Promise<void>
  onUpdateTag: (id: string, changes: Partial<{ label: string; parent_room_key: string | null }>) => Promise<void>
  onDeleteTag: (id: string) => Promise<void>
  onBack: () => void
}

interface RoomEntry {
  key: string
  label: string
  isStandard: boolean
  tagId?: string
}

interface ContainerEntry {
  key: string
  label: string
  isStandard: boolean
  tagId?: string
  parentRoomKey: string | null
}

function buildRooms(tags: HouseholdTag[], lang: Lang): RoomEntry[] {
  const rooms: RoomEntry[] = []

  // Standard rooms
  for (const key of Object.keys(ROOMS)) {
    rooms.push({ key, label: t(ROOMS, key, lang), isStandard: true })
  }

  // Custom rooms from tags
  for (const tag of tags) {
    if (tag.tag_type === 'room') {
      rooms.push({ key: tag.tag_key, label: tag.label, isStandard: false, tagId: tag.id })
    }
  }

  return rooms
}

function buildContainers(tags: HouseholdTag[], lang: Lang): ContainerEntry[] {
  const containers: ContainerEntry[] = []

  // Standard spots (no parent room)
  for (const key of Object.keys(SPOTS)) {
    containers.push({ key, label: t(SPOTS, key, lang), isStandard: true, parentRoomKey: null })
  }

  // Custom spots from tags
  for (const tag of tags) {
    if (tag.tag_type === 'spot') {
      containers.push({
        key: tag.tag_key,
        label: tag.label,
        isStandard: false,
        tagId: tag.id,
        parentRoomKey: tag.parent_room_key ?? null,
      })
    }
  }

  return containers
}

export function LocationsEditor({ tags, onSaveTag, onUpdateTag, onDeleteTag, onBack }: LocationsEditorProps) {
  const { language } = useLanguage()

  const rooms = buildRooms(tags, language)
  const containers = buildContainers(tags, language)

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [dragOverRoom, setDragOverRoom] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Inline add states
  const [addingRoom, setAddingRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [addingContainerFor, setAddingContainerFor] = useState<string | null>(null)
  const [newContainerName, setNewContainerName] = useState('')

  // Inline edit states
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // ─── Add Room ────────────────────────────────────────
  async function handleAddRoom() {
    const name = newRoomName.trim()
    if (!name) return
    const key = 'custom_' + name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    await onSaveTag({ tag_type: 'room', tag_key: key, label: name })
    setNewRoomName('')
    setAddingRoom(false)
  }

  // ─── Add Container ──────────────────────────────────
  async function handleAddContainer(roomKey: string) {
    const name = newContainerName.trim()
    if (!name) return
    const key = 'custom_' + name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    await onSaveTag({ tag_type: 'spot', tag_key: key, label: name, parent_room_key: roomKey })
    setNewContainerName('')
    setAddingContainerFor(null)
  }

  // ─── Inline Edit ────────────────────────────────────
  function startEdit(tagId: string, currentLabel: string) {
    setEditingId(tagId)
    setEditingValue(currentLabel)
  }

  async function saveEdit(tagId: string) {
    const name = editingValue.trim()
    if (!name) return
    await onUpdateTag(tagId, { label: name })
    setEditingId(null)
    setEditingValue('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingValue('')
  }

  // ─── Delete ─────────────────────────────────────────
  async function handleDelete(tagId: string) {
    if (!window.confirm(ui('locations.delete_confirm', language))) return
    await onDeleteTag(tagId)
  }

  // ─── Drag and Drop ─────────────────────────────────
  function handleDragStart(e: DragEvent, tagId: string) {
    e.dataTransfer.setData('text/plain', tagId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(tagId)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverRoom(null)
  }

  function handleDragOver(e: DragEvent, roomKey: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverRoom(roomKey)
  }

  function handleDragLeave(e: DragEvent, roomKey: string) {
    // Only clear if we're actually leaving this room section
    const related = e.relatedTarget as HTMLElement | null
    const current = e.currentTarget as HTMLElement
    if (!related || !current.contains(related)) {
      setDragOverRoom((prev) => (prev === roomKey ? null : prev))
    }
  }

  async function handleDrop(e: DragEvent, roomKey: string) {
    e.preventDefault()
    setDragOverRoom(null)
    const tagId = e.dataTransfer.getData('text/plain')
    if (!tagId) return
    // Use null for "general" section
    const newParent = roomKey === '__general__' ? null : roomKey
    await onUpdateTag(tagId, { parent_room_key: newParent })
  }

  // ─── Render helpers ─────────────────────────────────

  function getContainersForRoom(roomKey: string): { custom: ContainerEntry[]; standard: ContainerEntry[] } {
    const custom = containers.filter((c) => !c.isStandard && c.parentRoomKey === roomKey)
    // Standard spots only appear in the General section
    const standard = roomKey === '__general__' ? containers.filter((c) => c.isStandard) : []
    return { custom, standard }
  }

  function renderContainer(c: ContainerEntry) {
    if (c.isStandard) {
      return (
        <div key={c.key} className="locations-editor__std-container">
          <span className="locations-editor__std-container-label">{c.label}</span>
          <span className="locations-editor__std-badge">{ui('locations.standard', language)}</span>
        </div>
      )
    }

    const isEditing = editingId === c.tagId
    const isDragging = draggingId === c.tagId

    return (
      <div
        key={c.tagId}
        className={`locations-editor__container${isDragging ? ' locations-editor__container--dragging' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart(e, c.tagId!)}
        onDragEnd={handleDragEnd}
      >
        <GripVertical size={14} className="locations-editor__grip" />
        {isEditing ? (
          <>
            <input
              className="locations-editor__edit-input"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit(c.tagId!)
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
            />
            <button className="locations-editor__icon-btn" onClick={() => saveEdit(c.tagId!)}>
              <Check size={14} />
            </button>
            <button className="locations-editor__icon-btn" onClick={cancelEdit}>
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="locations-editor__container-label">{c.label}</span>
            <button className="locations-editor__icon-btn" onClick={() => startEdit(c.tagId!, c.label)}>
              <Pencil size={12} />
            </button>
            <button className="locations-editor__icon-btn locations-editor__icon-btn--danger" onClick={() => handleDelete(c.tagId!)}>
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    )
  }

  function renderRoomSection(room: RoomEntry) {
    const isCollapsed = collapsed[room.key] ?? false
    const { custom, standard } = getContainersForRoom(room.key)
    const isDragOver = dragOverRoom === room.key

    return (
      <div
        key={room.key}
        className={`locations-editor__room${isDragOver ? ' locations-editor__room--dragover' : ''}`}
        onDragOver={(e) => handleDragOver(e, room.key)}
        onDragLeave={(e) => handleDragLeave(e, room.key)}
        onDrop={(e) => handleDrop(e, room.key)}
      >
        <div className="locations-editor__room-header" onClick={() => toggleCollapse(room.key)}>
          <ChevronRight
            size={14}
            className={`locations-editor__chevron${!isCollapsed ? ' locations-editor__chevron--open' : ''}`}
          />
          <span className="locations-editor__room-label">{room.label}</span>
          <span className={`locations-editor__badge ${room.isStandard ? 'locations-editor__badge--standard' : 'locations-editor__badge--custom'}`}>
            {room.isStandard ? ui('locations.standard', language) : ui('locations.custom', language)}
          </span>
          {!room.isStandard && room.tagId && (
            <div className="locations-editor__room-actions" onClick={(e) => e.stopPropagation()}>
              {editingId === room.tagId ? (
                <>
                  <input
                    className="locations-editor__edit-input"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(room.tagId!)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button className="locations-editor__icon-btn" onClick={() => saveEdit(room.tagId!)}>
                    <Check size={14} />
                  </button>
                  <button className="locations-editor__icon-btn" onClick={cancelEdit}>
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button className="locations-editor__icon-btn" onClick={() => startEdit(room.tagId!, room.label)}>
                    <Pencil size={12} />
                  </button>
                  <button className="locations-editor__icon-btn locations-editor__icon-btn--danger" onClick={() => handleDelete(room.tagId!)}>
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div className="locations-editor__room-body">
            {custom.map(renderContainer)}

            {custom.length > 0 && standard.length > 0 && <hr className="locations-editor__separator" />}

            {standard.map(renderContainer)}

            {/* Add container inline */}
            {addingContainerFor === room.key ? (
              <div className="locations-editor__inline-add">
                <input
                  className="locations-editor__inline-input"
                  placeholder={ui('locations.enter_name', language)}
                  value={newContainerName}
                  onChange={(e) => setNewContainerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddContainer(room.key)
                    if (e.key === 'Escape') {
                      setAddingContainerFor(null)
                      setNewContainerName('')
                    }
                  }}
                  autoFocus
                />
                <button className="locations-editor__inline-btn locations-editor__inline-btn--confirm" onClick={() => handleAddContainer(room.key)}>
                  <Check size={14} />
                </button>
                <button
                  className="locations-editor__inline-btn locations-editor__inline-btn--cancel"
                  onClick={() => {
                    setAddingContainerFor(null)
                    setNewContainerName('')
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button className="locations-editor__add-container" onClick={() => setAddingContainerFor(room.key)}>
                <Plus size={12} />
                {ui('locations.add_container', language)}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // General section for unassigned containers
  function renderGeneralSection() {
    const customUnassigned = containers.filter((c) => !c.isStandard && c.parentRoomKey === null)
    const standardSpots = containers.filter((c) => c.isStandard)
    const isCollapsed = collapsed['__general__'] ?? false
    const isDragOver = dragOverRoom === '__general__'

    return (
      <div
        className={`locations-editor__room${isDragOver ? ' locations-editor__room--dragover' : ''}`}
        onDragOver={(e) => handleDragOver(e, '__general__')}
        onDragLeave={(e) => handleDragLeave(e, '__general__')}
        onDrop={(e) => handleDrop(e, '__general__')}
      >
        <div className="locations-editor__room-header" onClick={() => toggleCollapse('__general__')}>
          <ChevronRight
            size={14}
            className={`locations-editor__chevron${!isCollapsed ? ' locations-editor__chevron--open' : ''}`}
          />
          <span className="locations-editor__room-label">{ui('locations.general', language)}</span>
        </div>

        {!isCollapsed && (
          <div className="locations-editor__room-body">
            {customUnassigned.map(renderContainer)}

            {customUnassigned.length > 0 && standardSpots.length > 0 && <hr className="locations-editor__separator" />}

            {standardSpots.map(renderContainer)}

            {/* Add container for general section */}
            {addingContainerFor === '__general__' ? (
              <div className="locations-editor__inline-add">
                <input
                  className="locations-editor__inline-input"
                  placeholder={ui('locations.enter_name', language)}
                  value={newContainerName}
                  onChange={(e) => setNewContainerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddContainer('__general__')
                    if (e.key === 'Escape') {
                      setAddingContainerFor(null)
                      setNewContainerName('')
                    }
                  }}
                  autoFocus
                />
                <button className="locations-editor__inline-btn locations-editor__inline-btn--confirm" onClick={() => handleAddContainer('__general__')}>
                  <Check size={14} />
                </button>
                <button
                  className="locations-editor__inline-btn locations-editor__inline-btn--cancel"
                  onClick={() => {
                    setAddingContainerFor(null)
                    setNewContainerName('')
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button className="locations-editor__add-container" onClick={() => setAddingContainerFor('__general__')}>
                <Plus size={12} />
                {ui('locations.add_container', language)}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="locations-editor">
      <div className="locations-editor__header">
        <button className="locations-editor__back" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <h2 className="locations-editor__title">{ui('locations.title', language)}</h2>
      </div>

      <div className="locations-editor__body">
        <p className="locations-editor__hint">{ui('locations.drag_hint', language)}</p>

        {/* Add room */}
        {addingRoom ? (
          <div className="locations-editor__inline-add">
            <input
              className="locations-editor__inline-input"
              placeholder={ui('locations.enter_name', language)}
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddRoom()
                if (e.key === 'Escape') {
                  setAddingRoom(false)
                  setNewRoomName('')
                }
              }}
              autoFocus
            />
            <button className="locations-editor__inline-btn locations-editor__inline-btn--confirm" onClick={handleAddRoom}>
              <Check size={14} />
            </button>
            <button
              className="locations-editor__inline-btn locations-editor__inline-btn--cancel"
              onClick={() => {
                setAddingRoom(false)
                setNewRoomName('')
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button className="locations-editor__add-room" onClick={() => setAddingRoom(true)}>
            <Plus size={14} />
            {ui('locations.add_room', language)}
          </button>
        )}

        {/* Room sections */}
        {rooms.map(renderRoomSection)}

        {/* General (unassigned) section */}
        {renderGeneralSection()}
      </div>
    </div>
  )
}

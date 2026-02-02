import { useState } from 'react'
import { X, Trash2, Save } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import { ROOMS, SPOTS, SPOT_DETAILS, CATEGORIES, t } from '../i18n/picklists'
import type { StorageEntry, HouseholdTag } from '../types'
import { PhotoUpload } from './PhotoUpload'
import './ItemEditSheet.css'

interface ItemEditSheetProps {
  mode: 'create' | 'edit'
  entry?: StorageEntry | null
  householdId: string
  householdTags: HouseholdTag[]
  onSave: (data: {
    item_name: string
    room_key: string | null
    spot_key: string | null
    spot_detail: string | null
    category_key: string | null
    location_description: string
    photo_path?: string | null
  }) => void
  onDelete?: () => void
  onClose: () => void
}

function buildLocationDesc(roomKey: string | null, spotKey: string | null, detailKey: string | null): string {
  const parts: string[] = []
  if (roomKey) {
    const room = ROOMS[roomKey]
    parts.push(room ? room.en : roomKey)
  }
  if (spotKey) {
    const spot = SPOTS[spotKey]
    parts.push(spot ? spot.en : spotKey)
  }
  if (detailKey) {
    const detail = SPOT_DETAILS[detailKey]
    parts.push(detail ? detail.en : detailKey)
  }
  return parts.join(' \u203A ')
}

export function ItemEditSheet({ mode, entry, householdId, householdTags, onSave, onDelete, onClose }: ItemEditSheetProps) {
  const { language } = useLanguage()
  const [itemName, setItemName] = useState(entry?.item_name ?? '')
  const [roomKey, setRoomKey] = useState(entry?.room_key ?? '')
  const [spotKey, setSpotKey] = useState(entry?.spot_key ?? '')
  const [spotDetail, setSpotDetail] = useState(entry?.spot_detail ?? '')
  const [categoryKey, setCategoryKey] = useState(entry?.category_key ?? '')
  const [photoPath, setPhotoPath] = useState<string | null>(entry?.photo_path ?? null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const customRooms = householdTags.filter((t) => t.tag_type === 'room')
  const customSpots = householdTags.filter((t) => t.tag_type === 'spot')
  const customDetails = householdTags.filter((t) => t.tag_type === 'detail')

  function handleSave() {
    if (!itemName.trim()) return
    onSave({
      item_name: itemName.trim().toLowerCase(),
      room_key: roomKey || null,
      spot_key: spotKey || null,
      spot_detail: spotDetail || null,
      category_key: categoryKey || null,
      location_description: buildLocationDesc(roomKey || null, spotKey || null, spotDetail || null),
      photo_path: photoPath,
    })
  }

  if (showDeleteConfirm) {
    return (
      <>
        <div className="edit-sheet-overlay" onClick={() => setShowDeleteConfirm(false)} />
        <div className="edit-sheet">
          <div className="edit-sheet__handle"><div className="edit-sheet__handle-bar" /></div>
          <div className="edit-sheet__confirm">
            <p className="edit-sheet__confirm-text">{ui('edit.confirm_delete', language)}</p>
            <div className="edit-sheet__confirm-actions">
              <button className="edit-sheet__btn edit-sheet__btn--secondary" onClick={() => setShowDeleteConfirm(false)}>
                {ui('edit.cancel', language)}
              </button>
              <button className="edit-sheet__btn edit-sheet__btn--danger" onClick={onDelete}>
                <Trash2 size={14} />
                {ui('edit.delete', language)}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="edit-sheet-overlay" onClick={onClose} />
      <div className="edit-sheet">
        <div className="edit-sheet__handle"><div className="edit-sheet__handle-bar" /></div>
        <div className="edit-sheet__header">
          <h2 className="edit-sheet__title">
            {mode === 'edit' ? ui('edit.title', language) : ui('add.title', language)}
          </h2>
          <button className="edit-sheet__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="edit-sheet__form">
          <div className="edit-sheet__field">
            <label className="edit-sheet__label">{ui('add.item_name', language)}</label>
            <input
              className="edit-sheet__input"
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={ui('add.item_name', language)}
              autoFocus={mode === 'create'}
            />
          </div>

          <div className="edit-sheet__field">
            <label className="edit-sheet__label">{ui('add.room', language)}</label>
            <select className="edit-sheet__select" value={roomKey} onChange={(e) => setRoomKey(e.target.value)}>
              <option value="">—</option>
              {Object.entries(ROOMS).map(([key]) => (
                <option key={key} value={key}>{t(ROOMS, key, language)}</option>
              ))}
              {customRooms.map((tag) => (
                <option key={`custom-${tag.tag_key}`} value={tag.tag_key}>{tag.label}</option>
              ))}
            </select>
          </div>

          <div className="edit-sheet__field">
            <label className="edit-sheet__label">{ui('add.spot', language)}</label>
            <select className="edit-sheet__select" value={spotKey} onChange={(e) => setSpotKey(e.target.value)}>
              <option value="">—</option>
              {Object.entries(SPOTS).map(([key]) => (
                <option key={key} value={key}>{t(SPOTS, key, language)}</option>
              ))}
              {customSpots.map((tag) => (
                <option key={`custom-${tag.tag_key}`} value={tag.tag_key}>{tag.label}</option>
              ))}
            </select>
          </div>

          <div className="edit-sheet__field">
            <label className="edit-sheet__label">{ui('add.detail', language)}</label>
            <select className="edit-sheet__select" value={spotDetail} onChange={(e) => setSpotDetail(e.target.value)}>
              <option value="">—</option>
              {Object.entries(SPOT_DETAILS).map(([key]) => (
                <option key={key} value={key}>{t(SPOT_DETAILS, key, language)}</option>
              ))}
              {customDetails.map((tag) => (
                <option key={`custom-${tag.tag_key}`} value={tag.tag_key}>{tag.label}</option>
              ))}
            </select>
          </div>

          <div className="edit-sheet__field">
            <label className="edit-sheet__label">{ui('add.category', language)}</label>
            <select className="edit-sheet__select" value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
              <option value="">—</option>
              {Object.entries(CATEGORIES).map(([key]) => (
                <option key={key} value={key}>{t(CATEGORIES, key, language)}</option>
              ))}
            </select>
          </div>

          <PhotoUpload
            householdId={householdId}
            entryId={entry?.id ?? null}
            photoPath={photoPath}
            onPhotoChange={setPhotoPath}
          />
        </div>

        <div className="edit-sheet__actions">
          {mode === 'edit' && onDelete && (
            <button className="edit-sheet__btn edit-sheet__btn--danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={14} />
              {ui('edit.delete', language)}
            </button>
          )}
          <button
            className="edit-sheet__btn edit-sheet__btn--primary"
            onClick={handleSave}
            disabled={!itemName.trim()}
          >
            <Save size={14} />
            {mode === 'edit' ? ui('edit.save', language) : ui('add.save', language)}
          </button>
        </div>
      </div>
    </>
  )
}

import { Plus, Package, Pencil, Copy, MapPinPen, Trash2 } from 'lucide-react'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'
import type { PlaceWithChildren } from '../../../../hooks/usePlaces'
import { BottomSheet } from '../../../sheets/BottomSheet'
import './LocationActionSheet.css'

interface LocationActionSheetProps {
  place: PlaceWithChildren
  onAddItem: () => void
  onAddChild: () => void
  onEdit: () => void
  onDuplicate: () => void
  onMove: () => void
  onDelete: () => void
  onClose: () => void
}

export function LocationActionSheet({
  place,
  onAddItem,
  onAddChild,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
  onClose,
}: LocationActionSheetProps) {
  const { language } = useLanguage()

  return (
    <BottomSheet onClose={onClose} className="action-sheet">
      <div className="action-sheet__title">{place.label}</div>
      <div className="action-sheet__options">
        <button className="action-sheet__option" onClick={onAddItem}>
          <Package size={18} />
          <span>{ui('locations.add_item_here', language)}</span>
        </button>
        <button className="action-sheet__option" onClick={onAddChild}>
          <Plus size={18} />
          <span>{ui('locations.add_child', language)}</span>
        </button>
        <button className="action-sheet__option" onClick={onEdit}>
          <Pencil size={18} />
          <span>{ui('locations.edit', language)}</span>
        </button>
        <button className="action-sheet__option" onClick={onDuplicate}>
          <Copy size={18} />
          <span>{ui('locations.duplicate', language)}</span>
        </button>
        <button className="action-sheet__option" onClick={onMove}>
          <MapPinPen size={18} />
          <span>{ui('locations.move_to', language)}</span>
        </button>
        <div className="action-sheet__divider" />
        <button className="action-sheet__option action-sheet__option--danger" onClick={onDelete}>
          <Trash2 size={18} />
          <span>{ui('locations.delete', language)}</span>
        </button>
      </div>
    </BottomSheet>
  )
}

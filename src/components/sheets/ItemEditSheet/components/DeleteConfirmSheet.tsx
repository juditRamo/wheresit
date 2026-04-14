import { Trash2 } from 'lucide-react'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'
import { BottomSheet } from '../../BottomSheet'

interface DeleteConfirmSheetProps {
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteConfirmSheet({ onCancel, onConfirm }: DeleteConfirmSheetProps) {
  const { language } = useLanguage()

  return (
    <BottomSheet onClose={onCancel} className="edit-sheet">
      <div className="edit-sheet__confirm">
        <p className="edit-sheet__confirm-text">{ui('edit.confirm_delete', language)}</p>
        <div className="edit-sheet__confirm-actions">
          <button className="btn-secondary edit-sheet__btn edit-sheet__btn--secondary" onClick={onCancel}>
            {ui('edit.cancel', language)}
          </button>
          <button className="edit-sheet__btn edit-sheet__btn--danger" onClick={onConfirm}>
            <Trash2 size={14} />
            {ui('edit.delete', language)}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

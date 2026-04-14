import { Trash2, Save } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { ui } from '../../i18n/ui'

interface SheetActionsProps {
  onSave?: () => void
  saveDisabled?: boolean
  saveLabel?: string
  onCancel?: () => void
  cancelLabel?: string
  onDelete?: () => void
  deleteLabel?: string
}

export function SheetActions({ onSave, saveDisabled, saveLabel, onCancel, cancelLabel, onDelete, deleteLabel }: SheetActionsProps) {
  const { language } = useLanguage()

  return (
    <div className="edit-sheet__actions">
      {onCancel && (
        <button className="btn-secondary edit-sheet__btn edit-sheet__btn--secondary" onClick={onCancel}>
          {cancelLabel ?? ui('edit.cancel', language)}
        </button>
      )}
      {onDelete && (
        <button className="edit-sheet__btn edit-sheet__btn--danger" onClick={onDelete}>
          <Trash2 size={14} />
          {deleteLabel ?? ui('edit.delete', language)}
        </button>
      )}
      {onSave && (
        <button
          className="btn-gold edit-sheet__btn edit-sheet__btn--primary"
          onClick={onSave}
          disabled={saveDisabled}
        >
          <Save size={14} />
          {saveLabel ?? ui('edit.save', language)}
        </button>
      )}
    </div>
  )
}

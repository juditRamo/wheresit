import { Plus } from 'lucide-react'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'

interface InventoryEmptyStateProps {
  isWelcome: boolean
  onAdd: () => void
}

export function InventoryEmptyState({ isWelcome, onAdd }: InventoryEmptyStateProps) {
  const { language } = useLanguage()

  return (
    <div className="inventory__empty">
      {isWelcome ? (
        <>
          <p className="inventory__empty-title">{ui('inventory.empty_welcome', language)}</p>
          <p className="inventory__empty-hint">{ui('inventory.empty_hint', language)}</p>
          <button
            className="inventory__empty-cta"
            onClick={onAdd}
          >
            <Plus size={16} />
            {ui('add.title', language)}
          </button>
        </>
      ) : (
        <p>{ui('inventory.empty', language)}</p>
      )}
    </div>
  )
}

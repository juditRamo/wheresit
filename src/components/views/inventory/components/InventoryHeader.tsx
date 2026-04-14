import { RefreshCw, Plus } from 'lucide-react'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'

interface InventoryHeaderProps {
  totalCount: number
  loading: boolean
  onSync: () => void
  onAdd: () => void
}

export function InventoryHeader({ totalCount, loading, onSync, onAdd }: InventoryHeaderProps) {
  const { language } = useLanguage()

  return (
    <div className="inventory__header">
      <div className="inventory__header-left">
        <h1 className="inventory__title">
          {ui('inventory.title', language)}
          {totalCount > 0 && (
            <span className="inventory__subtitle"> ({totalCount})</span>
          )}
        </h1>
      </div>
      <div className="inventory__header-right">
        <button className="inventory__icon-btn" onClick={onSync} aria-label="Sync">
          <RefreshCw size={16} className={loading ? 'inventory__spin' : ''} />
        </button>
        <button
          className="inventory__icon-btn inventory__icon-btn--gold"
          aria-label="Add item"
          onClick={onAdd}
        >
          <Plus size={16} color="var(--text-on-gold)" />
        </button>
      </div>
    </div>
  )
}

import { getItemIcon, getLocationDisplay } from '../helpers'
import type { StorageEntry } from '../../../../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

interface InventoryItemCardProps {
  entry: StorageEntry
  getPlacePath: (id: string) => { label: string }[]
  onClick: () => void
}

export function InventoryItemCard({ entry, getPlacePath, onClick }: InventoryItemCardProps) {
  const ItemIcon = getItemIcon(entry.item_name)
  const thumbnailUrl = entry.photo_path
    ? `${supabaseUrl}/storage/v1/object/public/item-photos/${entry.photo_path}`
    : null

  return (
    <div
      data-entity-id={entry.id}
      className="inventory__item inventory__item--clickable"
      onClick={onClick}
    >
      <div className="inventory__item-icon">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="inventory__item-thumb" />
        ) : (
          <ItemIcon size={16} color="var(--gold-primary)" />
        )}
      </div>
      <div className="inventory__item-info">
        <span className="inventory__item-name">{entry.item_name}</span>
        <span className="inventory__item-loc">{getLocationDisplay(entry, getPlacePath)}</span>
      </div>
    </div>
  )
}

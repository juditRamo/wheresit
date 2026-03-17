import type { LucideIcon } from 'lucide-react'
import {
  DoorOpen, BedDouble, CookingPot, Bath, Sofa, Car,
  Armchair, Lamp, Monitor, Library, Rows3, Table2,
  Package, Inbox, Folder, Archive, Briefcase, ShoppingBag,
  MapPin, Home, Warehouse, Key, Tag, LayoutGrid,
} from 'lucide-react'

export interface PlaceIconEntry {
  id: string
  icon: LucideIcon
  category: 'rooms' | 'furniture' | 'containers' | 'misc'
}

export const PLACE_ICON_CATALOG: PlaceIconEntry[] = [
  // Rooms
  { id: 'door-open', icon: DoorOpen, category: 'rooms' },
  { id: 'bed-double', icon: BedDouble, category: 'rooms' },
  { id: 'cooking-pot', icon: CookingPot, category: 'rooms' },
  { id: 'bath', icon: Bath, category: 'rooms' },
  { id: 'sofa', icon: Sofa, category: 'rooms' },
  { id: 'car', icon: Car, category: 'rooms' },
  // Furniture
  { id: 'armchair', icon: Armchair, category: 'furniture' },
  { id: 'lamp', icon: Lamp, category: 'furniture' },
  { id: 'monitor', icon: Monitor, category: 'furniture' },
  { id: 'library', icon: Library, category: 'furniture' },
  { id: 'rows-3', icon: Rows3, category: 'furniture' },
  { id: 'table-2', icon: Table2, category: 'furniture' },
  // Containers
  { id: 'package', icon: Package, category: 'containers' },
  { id: 'inbox', icon: Inbox, category: 'containers' },
  { id: 'folder', icon: Folder, category: 'containers' },
  { id: 'archive', icon: Archive, category: 'containers' },
  { id: 'briefcase', icon: Briefcase, category: 'containers' },
  { id: 'shopping-bag', icon: ShoppingBag, category: 'containers' },
  // Misc
  { id: 'map-pin', icon: MapPin, category: 'misc' },
  { id: 'home', icon: Home, category: 'misc' },
  { id: 'warehouse', icon: Warehouse, category: 'misc' },
  { id: 'key', icon: Key, category: 'misc' },
  { id: 'tag', icon: Tag, category: 'misc' },
  { id: 'layout-grid', icon: LayoutGrid, category: 'misc' },
]

const iconMap = new Map(PLACE_ICON_CATALOG.map(e => [e.id, e.icon]))

export function getPlaceIcon(iconId: string): LucideIcon {
  return iconMap.get(iconId) ?? MapPin
}

export const ICON_CATEGORIES = ['rooms', 'furniture', 'containers', 'misc'] as const

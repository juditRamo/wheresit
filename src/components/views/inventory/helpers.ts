import {
  BookOpen,
  Watch,
  Key,
  Headphones,
  Package,
  Home,
} from 'lucide-react'
import { getPlaceIcon } from '../../../lib/placeIcons'
import type { StorageEntry, Place } from '../../../types'

export const ITEM_ICONS: Record<string, typeof Package> = {
  passport: BookOpen,
  book: BookOpen,
  watch: Watch,
  key: Key,
  keys: Key,
  headphone: Headphones,
  headphones: Headphones,
}

export function getItemIcon(itemName: string) {
  const lower = itemName.toLowerCase()
  for (const [keyword, Icon] of Object.entries(ITEM_ICONS)) {
    if (lower.includes(keyword)) return Icon
  }
  return Package
}

export function getPlaceGroupIcon(rootPlaceId: string, places: Place[]) {
  const place = places.find(p => p.id === rootPlaceId)
  if (place?.icon) return getPlaceIcon(place.icon)
  return Home
}

export function getLocationDisplay(
  entry: StorageEntry,
  getPlacePath: (id: string) => Array<{ label: string }>
): string {
  if (entry.place_id) {
    const path = getPlacePath(entry.place_id)
    if (path.length) return path.map((p) => p.label).join(' › ')
  }
  return entry.location_description ?? ''
}

export function getRootPlaceId(placeId: string | null, places: Array<{ id: string; parent_place_id: string | null }>): string | null {
  if (!placeId) return null
  const byId = new Map(places.map((p) => [p.id, p]))
  let current = placeId
  while (current) {
    const p = byId.get(current)
    if (!p) return current
    if (!p.parent_place_id) return current
    current = p.parent_place_id
  }
  return null
}

export function getRootPlaceLabel(entry: StorageEntry, places: Array<{ id: string; label: string; parent_place_id: string | null }>): string | null {
  if (entry.place_id) {
    const rootId = getRootPlaceId(entry.place_id, places)
    const byId = new Map(places.map((p) => [p.id, p]))
    const root = rootId ? byId.get(rootId) : null
    return root?.label ?? null
  }
  const first = entry.location_description?.split(' › ')[0]
  return first ?? null
}

export function groupByPlace(entries: StorageEntry[], places: Array<{ id: string; label: string; parent_place_id: string | null }>): Record<string, { key: string; label: string; entries: StorageEntry[] }> {
  const groups: Record<string, { key: string; label: string; entries: StorageEntry[] }> = {}
  const byId = new Map(places.map((p) => [p.id, p]))
  for (const entry of entries) {
    let groupKey: string
    let label: string
    if (entry.place_id) {
      const rootId = getRootPlaceId(entry.place_id, places)
      const root = rootId ? byId.get(rootId) : null
      groupKey = rootId ?? entry.place_id
      label = root?.label ?? entry.location_description?.split(' › ')[0] ?? 'Other'
    } else {
      groupKey = entry.location_description?.split(' › ')[0] ?? 'other'
      label = groupKey
    }
    if (!groups[groupKey]) groups[groupKey] = { key: groupKey, label, entries: [] }
    groups[groupKey].entries.push(entry)
  }
  return groups
}

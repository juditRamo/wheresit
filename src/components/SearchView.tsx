import { useState } from 'react'
import { Search, Package, BookOpen, Watch, Key, Headphones } from 'lucide-react'
import { useStorageEntries } from '../hooks/useStorageEntries'
import { usePlaces } from '../hooks/usePlaces'
import { useLanguage } from '../i18n/LanguageContext'
import { t, CATEGORIES } from '../i18n/picklists'
import { ui } from '../i18n/ui'
import type { StorageEntry, LocationRef } from '../types'
import './SearchView.css'

interface SearchViewProps {
  householdId: string
  onNavigateToItems: (filter: LocationRef) => void
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

const ITEM_ICONS: Record<string, typeof Package> = {
  passport: BookOpen,
  book: BookOpen,
  watch: Watch,
  key: Key,
  keys: Key,
  headphone: Headphones,
  headphones: Headphones,
}

function getItemIcon(itemName: string) {
  const lower = itemName.toLowerCase()
  for (const [keyword, Icon] of Object.entries(ITEM_ICONS)) {
    if (lower.includes(keyword)) return Icon
  }
  return Package
}

function buildLocationDisplay(entry: StorageEntry, placeLabel?: string | null): string {
  return placeLabel ?? entry.location_description
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function SearchView({ householdId, onNavigateToItems }: SearchViewProps) {
  const { entries } = useStorageEntries(householdId)
  const { getPlaceById } = usePlaces(householdId)
  const { language } = useLanguage()
  const [query, setQuery] = useState('')
  const [placeFilter, setPlaceFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const placeKeys = [...new Set(entries.map((e) => e.location_description?.split(' › ')[0]).filter(Boolean))] as string[]
  const categoryKeys = [...new Set(entries.map((e) => e.category_key).filter(Boolean))] as string[]

  let results = entries
  if (query) {
    const q = query.toLowerCase()
    results = results.filter(
      (e) => {
        const loc = buildLocationDisplay(e, e.place_id ? getPlaceById(e.place_id)?.label : null)
        return e.item_name.toLowerCase().includes(q) || loc.toLowerCase().includes(q)
      }
    )
  }
  if (placeFilter) {
    results = results.filter((e) => (e.location_description?.split(' › ')[0]) === placeFilter)
  }
  if (categoryFilter) {
    results = results.filter((e) => e.category_key === categoryFilter)
  }

  return (
    <div className="search-view">
      <div className="search-view__input-area">
        <div className="search-view__input-wrap">
          <Search size={16} color="var(--text-tertiary)" />
          <input
            type="text"
            className="search-view__input"
            placeholder={ui('search.placeholder', language)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="search-view__chips">
        {placeKeys.map((key) => (
          <button
            key={key}
            className={`search-view__chip ${placeFilter === key ? 'search-view__chip--active' : ''}`}
            onClick={() => setPlaceFilter(placeFilter === key ? null : key)}
          >
            {key}
          </button>
        ))}
        {placeKeys.length > 0 && categoryKeys.length > 0 && (
          <div className="search-view__chip-divider" />
        )}
        {categoryKeys.map((key) => (
          <button
            key={key}
            className={`search-view__chip ${categoryFilter === key ? 'search-view__chip--active' : ''}`}
            onClick={() => setCategoryFilter(categoryFilter === key ? null : key)}
          >
            {t(CATEGORIES, key, language)}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="search-view__results">
        {results.map((entry) => {
          const ItemIcon = getItemIcon(entry.item_name)
          const thumbnailUrl = entry.photo_path
            ? `${supabaseUrl}/storage/v1/object/public/item-photos/${entry.photo_path}`
            : null
          return (
            <div
              key={entry.id}
              className="search-view__result"
              onClick={() => {
                if (entry.place_id) {
                  onNavigateToItems({ place_id: entry.place_id, place_label: getPlaceById(entry.place_id)?.label })
                } else {
                  onNavigateToItems({ room_key: entry.location_description })
                }
              }}
            >
              <div className="search-view__result-icon">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="" className="search-view__result-thumb" />
                ) : (
                  <ItemIcon size={16} color="var(--gold-primary)" />
                )}
              </div>
              <div className="search-view__result-info">
                <span className="search-view__result-name">{highlightMatch(entry.item_name, query)}</span>
                <span className="search-view__result-loc">{buildLocationDisplay(entry, entry.place_id ? getPlaceById(entry.place_id)?.label : null)}</span>
              </div>
              {entry.category_key && (
                <span className="search-view__result-badge">
                  {t(CATEGORIES, entry.category_key, language)}
                </span>
              )}
            </div>
          )
        })}
        {results.length === 0 && (
          <div className="search-view__empty">
            <p>{query || placeFilter || categoryFilter ? ui('search.no_results', language) : ui('inventory.empty', language)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useRef, useEffect, createElement } from 'react'
import { PLACE_ICON_CATALOG, ICON_CATEGORIES, getPlaceIcon } from '../../lib/placeIcons'
import { useLanguage } from '../../i18n/LanguageContext'
import { ui } from '../../i18n/ui'
import './PlaceIconPicker.css'

interface PlaceIconPickerProps {
  selected: string
  onSelect: (id: string) => void
  compact?: boolean
}

export function PlaceIconPicker({ selected, onSelect, compact }: PlaceIconPickerProps) {
  const { language } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const grid = (
    <div className="icon-picker__grid-wrap">
      {ICON_CATEGORIES.map((cat) => (
        <div key={cat} className="icon-picker__category">
          <span className="icon-picker__category-label">
            {ui(`icons.${cat}`, language)}
          </span>
          <div className="icon-picker__grid">
            {PLACE_ICON_CATALOG.filter((e) => e.category === cat).map((entry) => {
              const Icon = entry.icon
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`icon-picker__btn ${selected === entry.id ? 'icon-picker__btn--selected' : ''}`}
                  onClick={() => {
                    onSelect(entry.id)
                    setOpen(false)
                  }}
                  aria-label={entry.id}
                >
                  <Icon size={18} />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  if (compact) {
    return (
      <div className="icon-picker icon-picker--compact" ref={ref}>
        <button
          type="button"
          className="icon-picker__trigger"
          onClick={() => setOpen(!open)}
          aria-label={ui('locations.choose_icon', language)}
        >
          {createElement(getPlaceIcon(selected), { size: 20 })}
        </button>
        {open && <div className="icon-picker__popover">{grid}</div>}
      </div>
    )
  }

  return <div className="icon-picker">{grid}</div>
}

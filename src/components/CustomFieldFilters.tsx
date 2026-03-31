import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import type { CustomField } from '../types'
import './CustomFieldFilters.css'

export interface CustomFieldFilter {
  fieldId: string
  textQuery?: string
  numberMin?: number
  numberMax?: number
  booleanValue?: boolean
  selectedOptions?: string[]
  dateFrom?: string
  dateTo?: string
}

interface CustomFieldFiltersProps {
  fields: CustomField[]
  filters: CustomFieldFilter[]
  onChange: (filters: CustomFieldFilter[]) => void
}

export function CustomFieldFilters({ fields, filters, onChange }: CustomFieldFiltersProps) {
  const { language } = useLanguage()
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Filterable fields (skip text — covered by search)
  const filterableFields = fields.filter(f => f.field_type !== 'text')

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenPopover(null)
      }
    }
    if (openPopover) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openPopover])

  if (filterableFields.length === 0) return null

  function getFilter(fieldId: string): CustomFieldFilter | undefined {
    return filters.find(f => f.fieldId === fieldId)
  }

  function setFilter(fieldId: string, update: Partial<CustomFieldFilter>) {
    const existing = filters.find(f => f.fieldId === fieldId)
    if (existing) {
      onChange(filters.map(f => f.fieldId === fieldId ? { ...f, ...update } : f))
    } else {
      onChange([...filters, { fieldId, ...update }])
    }
  }

  function removeFilter(fieldId: string) {
    onChange(filters.filter(f => f.fieldId !== fieldId))
  }

  function clearAll() {
    onChange([])
    setOpenPopover(null)
  }

  function isActive(fieldId: string): boolean {
    const f = getFilter(fieldId)
    if (!f) return false
    if (f.booleanValue != null) return true
    if (f.numberMin != null || f.numberMax != null) return true
    if (f.dateFrom != null || f.dateTo != null) return true
    if (f.selectedOptions && f.selectedOptions.length > 0) return true
    return false
  }

  function getActiveLabel(field: CustomField): string | null {
    const f = getFilter(field.id)
    if (!f) return null
    if (field.field_type === 'boolean' && f.booleanValue != null) {
      return f.booleanValue ? ui('cf.yes', language) : ui('cf.no', language)
    }
    if (field.field_type === 'number') {
      if (f.numberMin != null && f.numberMax != null) return `${f.numberMin}–${f.numberMax}`
      if (f.numberMin != null) return `≥${f.numberMin}`
      if (f.numberMax != null) return `≤${f.numberMax}`
    }
    if (field.field_type === 'date') {
      if (f.dateFrom != null && f.dateTo != null) return `${f.dateFrom}–${f.dateTo}`
      if (f.dateFrom != null) return `≥${f.dateFrom}`
      if (f.dateTo != null) return `≤${f.dateTo}`
    }
    if (f.selectedOptions && f.selectedOptions.length > 0) {
      if (f.selectedOptions.length <= 2) {
        const labels = f.selectedOptions.map(id => {
          const opt = field.options.find(o => o.id === id)
          return opt ? opt.label : id
        })
        return labels.join(', ')
      }
      return `${f.selectedOptions.length}`
    }
    return null
  }

  const hasActiveFilters = filters.some(f => isActive(f.fieldId))

  return (
    <div className="cf-filters">
      <div className="cf-filters__chips">
        <span className="cf-filters__label">{ui('cf.filter', language)}</span>
        {filterableFields.map(field => {
          const active = isActive(field.id)
          return (
            <div key={field.id} className="cf-filters__chip-wrapper" ref={openPopover === field.id ? popoverRef : undefined}>
              <button
                className={`cf-filters__chip ${active ? 'cf-filters__chip--active' : ''}`}
                onClick={() => setOpenPopover(openPopover === field.id ? null : field.id)}
              >
                {field.name}
                {active && <span className="cf-filters__chip-value">{getActiveLabel(field)}</span>}
                <ChevronDown size={12} />
              </button>

              {openPopover === field.id && (
                <div className="cf-filters__popover">
                  {field.field_type === 'boolean' && (
                    <div className="cf-filters__bool-group">
                      {[
                        { label: ui('cf.all', language), value: undefined },
                        { label: ui('cf.yes', language), value: true },
                        { label: ui('cf.no', language), value: false },
                      ].map(opt => (
                        <button
                          key={String(opt.value)}
                          className={`cf-filters__bool-opt ${getFilter(field.id)?.booleanValue === opt.value ? 'cf-filters__bool-opt--active' : ''}`}
                          onClick={() => {
                            if (opt.value === undefined) removeFilter(field.id)
                            else setFilter(field.id, { booleanValue: opt.value })
                            setOpenPopover(null)
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {field.field_type === 'number' && (
                    <div className="cf-filters__number-range">
                      <input
                        type="number"
                        className="cf-filters__number-input"
                        placeholder={ui('cf.min', language)}
                        inputMode="decimal"
                        value={getFilter(field.id)?.numberMin ?? ''}
                        onChange={e => {
                          const v = e.target.value === '' ? undefined : Number(e.target.value)
                          const existing = getFilter(field.id)
                          if (v === undefined && existing?.numberMax == null) removeFilter(field.id)
                          else setFilter(field.id, { numberMin: v, numberMax: existing?.numberMax })
                        }}
                      />
                      <span className="cf-filters__range-sep">–</span>
                      <input
                        type="number"
                        className="cf-filters__number-input"
                        placeholder={ui('cf.max', language)}
                        inputMode="decimal"
                        value={getFilter(field.id)?.numberMax ?? ''}
                        onChange={e => {
                          const v = e.target.value === '' ? undefined : Number(e.target.value)
                          const existing = getFilter(field.id)
                          if (v === undefined && existing?.numberMin == null) removeFilter(field.id)
                          else setFilter(field.id, { numberMax: v, numberMin: existing?.numberMin })
                        }}
                      />
                    </div>
                  )}

                  {field.field_type === 'date' && (
                    <div className="cf-filters__date-range">
                      <input
                        type="date"
                        className="cf-filters__date-input"
                        placeholder={ui('cf.from', language)}
                        value={getFilter(field.id)?.dateFrom ?? ''}
                        onChange={e => {
                          const v = e.target.value || undefined
                          const existing = getFilter(field.id)
                          if (v === undefined && existing?.dateTo == null) removeFilter(field.id)
                          else setFilter(field.id, { dateFrom: v, dateTo: existing?.dateTo })
                        }}
                      />
                      <span className="cf-filters__range-sep">–</span>
                      <input
                        type="date"
                        className="cf-filters__date-input"
                        placeholder={ui('cf.to', language)}
                        value={getFilter(field.id)?.dateTo ?? ''}
                        onChange={e => {
                          const v = e.target.value || undefined
                          const existing = getFilter(field.id)
                          if (v === undefined && existing?.dateFrom == null) removeFilter(field.id)
                          else setFilter(field.id, { dateTo: v, dateFrom: existing?.dateFrom })
                        }}
                      />
                    </div>
                  )}

                  {(field.field_type === 'select' || field.field_type === 'multiselect') && (
                    <div className="cf-filters__option-list">
                      {field.options.map(opt => {
                        const selected = getFilter(field.id)?.selectedOptions?.includes(opt.id) ?? false
                        return (
                          <label key={opt.id} className="cf-filters__option-item">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                const current = getFilter(field.id)?.selectedOptions ?? []
                                const next = selected ? current.filter(o => o !== opt.id) : [...current, opt.id]
                                if (next.length === 0) removeFilter(field.id)
                                else setFilter(field.id, { selectedOptions: next })
                              }}
                            />
                            <span>{opt.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {hasActiveFilters && (
          <button className="cf-filters__clear" onClick={clearAll}>
            <X size={12} />
            {ui('cf.clear_filters', language)}
          </button>
        )}
      </div>

      {/* Active filter tags */}
      {hasActiveFilters && (
        <div className="cf-filters__tags">
          {filters.map(f => {
            const field = filterableFields.find(ff => ff.id === f.fieldId)
            if (!field || !isActive(f.fieldId)) return null
            return (
              <span key={f.fieldId} className="cf-filters__tag">
                {field.name}: {getActiveLabel(field)}
                <button className="cf-filters__tag-remove" onClick={() => removeFilter(f.fieldId)}>
                  <X size={10} />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

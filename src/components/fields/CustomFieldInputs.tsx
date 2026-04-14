import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { ui } from '../../i18n/ui'
import type { CustomField, CustomFieldOption } from '../../types'
import './CustomFieldInputs.css'

interface CustomFieldInputsProps {
  fields: CustomField[]
  values: Record<string, unknown>
  onChange: (fieldId: string, value: unknown) => void
  onCreateOption?: (fieldId: string, label: string) => Promise<CustomFieldOption | null>
}

function SelectWithAdd({ field, value, onChange, onCreateOption, language }: {
  field: CustomField
  value: string | null
  onChange: (value: string | null) => void
  onCreateOption?: (fieldId: string, label: string) => Promise<CustomFieldOption | null>
  language: 'en' | 'es'
}) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addValue, setAddValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setAdding(false)
        setAddValue('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (adding && addInputRef.current) addInputRef.current.focus()
  }, [adding])

  const selectedOpt = field.options.find(o => o.id === value)

  async function handleAdd() {
    const trimmed = addValue.trim()
    if (!trimmed || !onCreateOption) return
    const created = await onCreateOption(field.id, trimmed)
    if (created) onChange(created.id)
    setAddValue('')
    setAdding(false)
    setOpen(false)
  }

  return (
    <div className="cf-inputs__select-wrapper" ref={containerRef}>
      <button
        type="button"
        className="cf-inputs__select-btn"
        onClick={() => setOpen(!open)}
      >
        <span className={selectedOpt ? '' : 'cf-inputs__select-placeholder'}>
          {selectedOpt ? selectedOpt.label : ui('cf.none', language)}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="cf-inputs__select-dropdown">
          <button
            type="button"
            className={`cf-inputs__select-option ${!value ? 'cf-inputs__select-option--active' : ''}`}
            onClick={() => { onChange(null); setOpen(false) }}
          >
            {ui('cf.none', language)}
          </button>
          {field.options.map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`cf-inputs__select-option ${value === opt.id ? 'cf-inputs__select-option--active' : ''}`}
              onClick={() => { onChange(opt.id); setOpen(false) }}
            >
              {opt.label}
            </button>
          ))}
          {onCreateOption && (
            adding ? (
              <div className="cf-inputs__select-add-input">
                <input
                  ref={addInputRef}
                  type="text"
                  value={addValue}
                  onChange={e => setAddValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
                    if (e.key === 'Escape') { setAdding(false); setAddValue('') }
                  }}
                  onBlur={handleAdd}
                  placeholder={ui('cf.option_placeholder', language)}
                  className="cf-inputs__select-add-field"
                />
              </div>
            ) : (
              <button
                type="button"
                className="cf-inputs__select-option cf-inputs__select-option--add"
                onClick={() => setAdding(true)}
              >
                <Plus size={12} />
                {ui('cf.add_new_option', language)}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

export function CustomFieldInputs({ fields, values, onChange, onCreateOption }: CustomFieldInputsProps) {
  const { language } = useLanguage()
  const [addingMultiselect, setAddingMultiselect] = useState<string | null>(null)
  const [multiAddValue, setMultiAddValue] = useState('')
  const multiAddRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingMultiselect && multiAddRef.current) multiAddRef.current.focus()
  }, [addingMultiselect])

  if (fields.length === 0) return null

  async function handleMultiAdd(fieldId: string) {
    const trimmed = multiAddValue.trim()
    if (!trimmed || !onCreateOption) return
    const created = await onCreateOption(fieldId, trimmed)
    if (created) {
      const current = Array.isArray(values[fieldId]) ? (values[fieldId] as string[]) : []
      onChange(fieldId, [...current, created.id])
    }
    setMultiAddValue('')
    setAddingMultiselect(null)
  }

  return (
    <div className="cf-inputs">
      {fields.map(field => {
        const val = values[field.id]
        return (
          <div key={field.id} className="edit-sheet__field">
            <label className="edit-sheet__label">{field.name}</label>
            {field.field_type === 'text' && (
              <input
                type="text"
                className="input-field edit-sheet__input"
                value={(val as string) ?? ''}
                onChange={e => onChange(field.id, e.target.value || null)}
              />
            )}
            {field.field_type === 'number' && (
              <input
                type="number"
                className="input-field edit-sheet__input"
                inputMode="decimal"
                value={val != null ? String(val) : ''}
                onChange={e => {
                  const v = e.target.value
                  onChange(field.id, v === '' ? null : Number(v))
                }}
              />
            )}
            {field.field_type === 'boolean' && (
              <div className="cf-inputs__bool-toggle">
                <button
                  type="button"
                  className={`cf-inputs__bool-btn ${val === true ? 'cf-inputs__bool-btn--active' : ''}`}
                  onClick={() => onChange(field.id, val === true ? null : true)}
                >
                  {ui('cf.yes', language)}
                </button>
                <button
                  type="button"
                  className={`cf-inputs__bool-btn ${val === false ? 'cf-inputs__bool-btn--active' : ''}`}
                  onClick={() => onChange(field.id, val === false ? null : false)}
                >
                  {ui('cf.no', language)}
                </button>
              </div>
            )}
            {field.field_type === 'select' && (
              <SelectWithAdd
                field={field}
                value={(val as string) ?? null}
                onChange={v => onChange(field.id, v)}
                onCreateOption={onCreateOption}
                language={language}
              />
            )}
            {field.field_type === 'date' && (
              <input
                type="date"
                className="input-field edit-sheet__input"
                value={(val as string) ?? ''}
                onChange={e => onChange(field.id, e.target.value || null)}
              />
            )}
            {field.field_type === 'multiselect' && (
              <div className="cf-inputs__pills">
                {field.options.map(opt => {
                  const selected = Array.isArray(val) && (val as string[]).includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`cf-inputs__pill ${selected ? 'cf-inputs__pill--active' : ''}`}
                      onClick={() => {
                        const current = Array.isArray(val) ? (val as string[]) : []
                        const next = selected ? current.filter(v => v !== opt.id) : [...current, opt.id]
                        onChange(field.id, next.length > 0 ? next : null)
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
                {onCreateOption && (
                  addingMultiselect === field.id ? (
                    <input
                      ref={multiAddRef}
                      type="text"
                      className="cf-inputs__pill-add-input"
                      value={multiAddValue}
                      onChange={e => setMultiAddValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); handleMultiAdd(field.id) }
                        if (e.key === 'Escape') { setAddingMultiselect(null); setMultiAddValue('') }
                      }}
                      onBlur={() => handleMultiAdd(field.id)}
                      placeholder={ui('cf.option_placeholder', language)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="cf-inputs__pill cf-inputs__pill--add"
                      onClick={() => { setAddingMultiselect(field.id); setMultiAddValue('') }}
                    >
                      <Plus size={12} />
                      {ui('cf.add_new_option', language)}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

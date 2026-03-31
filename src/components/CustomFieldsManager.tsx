import { useState, useRef } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import type { CustomField, CustomFieldOption, CustomFieldType } from '../types'
import './CustomFieldsManager.css'

interface CustomFieldsManagerProps {
  fields: CustomField[]
  onCreateField: (field: { name: string; field_type: string }) => Promise<void>
  onUpdateField: (id: string, updates: { name?: string }) => Promise<void>
  onDeleteField: (id: string) => Promise<void>
  onReorderFields: (orderedIds: string[]) => Promise<void>
  onCreateOption: (fieldId: string, label: string) => Promise<CustomFieldOption | null>
  onUpdateOption: (optionId: string, label: string) => Promise<void>
  onDeleteOption: (optionId: string) => Promise<void>
}

const FIELD_TYPES: CustomFieldType[] = ['text', 'number', 'boolean', 'select', 'multiselect', 'date']

function fieldTypeLabel(type: CustomFieldType, lang: 'en' | 'es'): string {
  return ui(`cf.type_${type}`, lang)
}

function InlineOptionEditor({ option, onUpdate, onDelete }: {
  option: CustomFieldOption
  onUpdate: (label: string) => void
  onDelete: () => void
}) {
  const [value, setValue] = useState(option.label)
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== option.label) {
      onUpdate(trimmed)
    } else {
      setValue(option.label)
    }
  }

  return (
    <div className="cf-manager__option-row">
      <input
        ref={inputRef}
        type="text"
        className="cf-manager__option-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur() }
        }}
      />
      <button className="cf-manager__option-remove" onClick={onDelete}>
        <X size={12} />
      </button>
    </div>
  )
}

function TrailingOptionInput({ onAdd, placeholder }: {
  onAdd: (label: string) => void
  placeholder: string
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
      setValue('')
    }
  }

  return (
    <div className="cf-manager__option-row cf-manager__option-row--trailing">
      <input
        ref={inputRef}
        type="text"
        className="cf-manager__option-input cf-manager__option-input--trailing"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur() }
        }}
        placeholder={placeholder}
      />
    </div>
  )
}

export function CustomFieldsManager({ fields, onCreateField, onUpdateField, onDeleteField, onReorderFields, onCreateOption, onUpdateOption, onDeleteOption }: CustomFieldsManagerProps) {
  const { language } = useLanguage()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CustomFieldType>('text')

  // Edit form state
  const [editName, setEditName] = useState('')

  function resetCreate() {
    setNewName('')
    setNewType('text')
    setShowCreate(false)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    await onCreateField({ name: newName.trim(), field_type: newType })
    resetCreate()
  }

  function startEdit(field: CustomField) {
    setEditingId(field.id)
    setEditName(field.name)
  }

  async function handleSaveEdit(field: CustomField) {
    const updates: { name?: string } = {}
    if (editName.trim() !== field.name) updates.name = editName.trim()
    if (Object.keys(updates).length > 0) {
      await onUpdateField(field.id, updates)
    }
    setEditingId(null)
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= fields.length) return
    const ids = fields.map(f => f.id)
    const tmp = ids[index]
    ids[index] = ids[newIndex]
    ids[newIndex] = tmp
    await onReorderFields(ids)
  }

  async function handleDelete(id: string) {
    await onDeleteField(id)
    setDeleteConfirmId(null)
  }

  return (
    <div className="cf-manager">
      {fields.length === 0 && !showCreate && (
        <p className="cf-manager__empty">{ui('cf.no_fields', language)}</p>
      )}

      {fields.map((field, index) => (
        <div key={field.id} className="cf-manager__field">
          {deleteConfirmId === field.id ? (
            <div className="cf-manager__delete-confirm">
              <p className="cf-manager__delete-text">
                {ui('cf.delete_confirm', language, { name: field.name })}
              </p>
              <div className="cf-manager__delete-actions">
                <button className="cf-manager__btn cf-manager__btn--secondary" onClick={() => setDeleteConfirmId(null)}>
                  {ui('edit.cancel', language)}
                </button>
                <button className="cf-manager__btn cf-manager__btn--danger" onClick={() => handleDelete(field.id)}>
                  <Trash2 size={12} />
                  {ui('edit.delete', language)}
                </button>
              </div>
            </div>
          ) : editingId === field.id ? (
            <div className="cf-manager__edit-form">
              <input
                type="text"
                className="cf-manager__input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder={ui('cf.name', language)}
              />
              <span className="cf-manager__type-badge">{fieldTypeLabel(field.field_type as CustomFieldType, language)}</span>
              {(field.field_type === 'select' || field.field_type === 'multiselect') && (
                <div className="cf-manager__options">
                  <label className="cf-manager__label">{ui('cf.options', language)}</label>
                  {field.options.map(opt => (
                    <InlineOptionEditor
                      key={opt.id}
                      option={opt}
                      onUpdate={label => onUpdateOption(opt.id, label)}
                      onDelete={() => onDeleteOption(opt.id)}
                    />
                  ))}
                  <TrailingOptionInput
                    onAdd={label => onCreateOption(field.id, label)}
                    placeholder={ui('cf.option_placeholder', language)}
                  />
                </div>
              )}
              <div className="cf-manager__form-actions">
                <button className="cf-manager__btn cf-manager__btn--secondary" onClick={() => setEditingId(null)}>
                  {ui('edit.cancel', language)}
                </button>
                <button className="cf-manager__btn cf-manager__btn--primary" onClick={() => handleSaveEdit(field)} disabled={!editName.trim()}>
                  {ui('settings.save', language)}
                </button>
              </div>
            </div>
          ) : (
            <div className="cf-manager__field-row">
              <div className="cf-manager__field-info" onClick={() => startEdit(field)}>
                <span className="cf-manager__field-name">{field.name}</span>
                <span className="cf-manager__type-badge">{fieldTypeLabel(field.field_type as CustomFieldType, language)}</span>
              </div>
              <div className="cf-manager__field-actions">
                <button className="cf-manager__move-btn" onClick={() => handleMove(index, -1)} disabled={index === 0}>
                  <ChevronUp size={14} />
                </button>
                <button className="cf-manager__move-btn" onClick={() => handleMove(index, 1)} disabled={index === fields.length - 1}>
                  <ChevronDown size={14} />
                </button>
                <button className="cf-manager__move-btn cf-manager__move-btn--danger" onClick={() => setDeleteConfirmId(field.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showCreate ? (
        <div className="cf-manager__create-form">
          <input
            type="text"
            className="cf-manager__input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={ui('cf.name', language)}
            autoFocus
          />
          <label className="cf-manager__label">{ui('cf.type', language)}</label>
          <div className="cf-manager__type-picker">
            {FIELD_TYPES.map(t => (
              <button
                key={t}
                className={`cf-manager__type-opt ${newType === t ? 'cf-manager__type-opt--active' : ''}`}
                onClick={() => setNewType(t)}
              >
                {fieldTypeLabel(t, language)}
              </button>
            ))}
          </div>
          <div className="cf-manager__form-actions">
            <button className="cf-manager__btn cf-manager__btn--secondary" onClick={resetCreate}>
              {ui('edit.cancel', language)}
            </button>
            <button className="cf-manager__btn cf-manager__btn--primary" onClick={handleCreate} disabled={!newName.trim()}>
              {ui('cf.save', language)}
            </button>
          </div>
        </div>
      ) : (
        <button className="cf-manager__add-btn" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          {ui('cf.add', language)}
        </button>
      )}
    </div>
  )
}

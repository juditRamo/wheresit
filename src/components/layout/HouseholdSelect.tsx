import { useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { ui } from '../../i18n/ui'
import type { Household } from '../../types'
import './HouseholdSelect.css'

interface HouseholdSelectProps {
  households: Household[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (name: string) => Promise<{ error?: unknown }>
  onJoin: (householdId: string) => Promise<{ error?: unknown }>
}

export function HouseholdSelect({
  households,
  selectedId,
  onSelect,
  onCreate,
  onJoin,
}: HouseholdSelectProps) {
  const { language } = useLanguage()
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [tab, setTab] = useState<'pick' | 'create' | 'join'>('pick')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createName.trim()) return
    setMessage(null)
    setLoading(true)
    const { error } = await onCreate(createName.trim())
    setLoading(false)
    if (error) setMessage({ type: 'error', text: String(error) })
    else {
      setMessage({ type: 'success', text: ui('household.created', language) })
      setCreateName('')
      setTab('pick')
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const id = joinCode.trim()
    if (!id) return
    setMessage(null)
    setLoading(true)
    const { error } = await onJoin(id)
    setLoading(false)
    if (error) setMessage({ type: 'error', text: String(error) })
    else {
      setMessage({ type: 'success', text: ui('household.joined', language) })
      setJoinCode('')
      setTab('pick')
    }
  }

  if (households.length > 0 && selectedId && tab === 'pick') {
    return (
      <div className="household-select household-select--compact">
        <label className="household-select__label">{ui('household.label', language)}</label>
        <select
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          className="household-select__select"
        >
          {households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="household-select__add"
          onClick={() => setTab('create')}
        >
          {ui('household.new', language)}
        </button>
        <button
          type="button"
          className="household-select__add"
          onClick={() => setTab('join')}
        >
          {ui('household.join_with_code', language)}
        </button>
      </div>
    )
  }

  const isSetup = households.length === 0
  return (
    <div className="household-select">
      <h1>
        {tab === 'create' ? ui('household.new_title', language) : tab === 'join' ? ui('household.join_title', language) : ui('household.setup_title', language)}
      </h1>
      <p className="household-select__subtitle">
        {isSetup
          ? ui('household.setup_desc', language)
          : tab === 'create'
            ? ui('household.create_another', language)
            : ui('household.join_desc', language)}
      </p>

      {tab === 'pick' && isSetup && (
        <div className="household-select__tabs">
          <button type="button" onClick={() => setTab('create')} className="household-select__tab">
            {ui('household.create', language)}
          </button>
          <button type="button" onClick={() => setTab('join')} className="household-select__tab">
            {ui('household.join_tab', language)}
          </button>
        </div>
      )}

      {tab === 'create' && (
        <form onSubmit={handleCreate} className="household-select__form">
          <input
            className="input-field"
            type="text"
            placeholder={ui('household.name_placeholder', language)}
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            required
          />
          {message && (
            <p className={`household-select__message household-select__message--${message.type}`}>
              {message.text}
            </p>
          )}
          <div className="household-select__actions">
            <button type="submit" className="btn-ghost-gold" disabled={loading}>
              {loading ? '…' : ui('household.create_btn', language)}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setTab('pick')}>
              {ui('household.back', language)}
            </button>
          </div>
        </form>
      )}

      {tab === 'join' && (
        <form onSubmit={handleJoin} className="household-select__form">
          <input
            className="input-field"
            type="text"
            placeholder={ui('household.code_placeholder', language)}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            required
          />
          {message && (
            <p className={`household-select__message household-select__message--${message.type}`}>
              {message.text}
            </p>
          )}
          <div className="household-select__actions">
            <button type="submit" className="btn-ghost-gold" disabled={loading}>
              {loading ? '…' : ui('household.join_btn', language)}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setTab('pick')}>
              {ui('household.back', language)}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

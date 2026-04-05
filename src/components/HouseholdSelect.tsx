import { useState } from 'react'
import type { Household } from '../types'
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
      setMessage({ type: 'success', text: 'Household created.' })
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
      setMessage({ type: 'success', text: 'Joined household.' })
      setJoinCode('')
      setTab('pick')
    }
  }

  if (households.length > 0 && selectedId && tab === 'pick') {
    return (
      <div className="household-select household-select--compact">
        <label className="household-select__label">Household</label>
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
          + New household
        </button>
        <button
          type="button"
          className="household-select__add"
          onClick={() => setTab('join')}
        >
          Join with code
        </button>
      </div>
    )
  }

  const isSetup = households.length === 0
  return (
    <div className="household-select">
      <h1>
        {tab === 'create' ? 'New household' : tab === 'join' ? 'Join with code' : 'Set up your household'}
      </h1>
      <p className="household-select__subtitle">
        {isSetup
          ? 'Create a household to start tracking where you store things, or join one with a code.'
          : tab === 'create'
            ? 'Create another household.'
            : 'Enter the household ID or invite code to join.'}
      </p>

      {tab === 'pick' && isSetup && (
        <div className="household-select__tabs">
          <button type="button" onClick={() => setTab('create')} className="household-select__tab">
            Create household
          </button>
          <button type="button" onClick={() => setTab('join')} className="household-select__tab">
            Join with code
          </button>
        </div>
      )}

      {tab === 'create' && (
        <form onSubmit={handleCreate} className="household-select__form">
          <input
            className="input-field"
            type="text"
            placeholder="Household name (e.g. Home)"
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
              {loading ? '…' : 'Create'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setTab('pick')}>
              Back
            </button>
          </div>
        </form>
      )}

      {tab === 'join' && (
        <form onSubmit={handleJoin} className="household-select__form">
          <input
            className="input-field"
            type="text"
            placeholder="Paste household ID or invite code"
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
              {loading ? '…' : 'Join'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setTab('pick')}>
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

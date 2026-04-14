import { useState, useEffect } from 'react'
import { Copy, Check, Pencil } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Clipboard } from '@capacitor/clipboard'
import { supabase } from '../../../../supabaseClient'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'
import type { Household } from '../../../../types'
import type { User as AuthUser } from '@supabase/supabase-js'
import './SettingsHouseholdTab.css'

interface SettingsHouseholdTabProps {
  user: AuthUser
  household: Household
  households: Household[]
  selectedId: string
  onSelectHousehold: (id: string) => void
  onCreateHousehold: (name: string) => Promise<{ error?: unknown }>
  onJoinHousehold: (householdId: string) => Promise<{ error?: unknown }>
  onUpdateHouseholdName: (householdId: string, name: string) => Promise<{ data?: Household; error?: unknown }>
}

interface MemberInfo {
  user_id: string
  role: string
  email?: string
  display_name?: string | null
}

const ADD_NEW_SENTINEL = '__add_new__'

export function SettingsHouseholdTab({ user, household, households, selectedId, onSelectHousehold, onCreateHousehold, onJoinHousehold, onUpdateHouseholdName }: SettingsHouseholdTabProps) {
  const { language } = useLanguage()

  const [copied, setCopied] = useState(false)
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [createHouseholdOpen, setCreateHouseholdOpen] = useState(false)
  const [createHouseholdName, setCreateHouseholdName] = useState('')
  const [joinHouseholdOpen, setJoinHouseholdOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [householdMessage, setHouseholdMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [householdLoading, setHouseholdLoading] = useState(false)
  const [editHouseholdNameOpen, setEditHouseholdNameOpen] = useState(false)
  const [householdName, setHouseholdName] = useState(household.name)
  const [householdNameSaveStatus, setHouseholdNameSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [addHouseholdOpen, setAddHouseholdOpen] = useState(false)

  useEffect(() => {
    setHouseholdName(household.name)
  }, [household.name])

  useEffect(() => {
    let cancelled = false
    async function loadMembers() {
      const { data: membersData } = await supabase
        .from('household_members')
        .select('user_id, role')
        .eq('household_id', household.id)
      if (cancelled || !membersData?.length) {
        if (!cancelled) setMembers((membersData ?? []).map((m: { user_id: string; role: string }) => ({ user_id: m.user_id, role: m.role })))
        return
      }
      const userIds = membersData.map((m) => m.user_id)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)
      if (cancelled) return
      const profileByUserId = new Map<string, string | null>()
      for (const p of profilesData ?? []) {
        profileByUserId.set(p.id, p.display_name ?? null)
      }
      setMembers(
        membersData.map((m: { user_id: string; role: string }) => ({
          user_id: m.user_id,
          role: m.role,
          display_name: profileByUserId.get(m.user_id) ?? undefined,
        }))
      )
    }
    loadMembers()
    return () => { cancelled = true }
  }, [household.id])

  async function handleCopyCode() {
    try {
      if (Capacitor.isNativePlatform()) {
        await Clipboard.write({ string: household.id })
      } else {
        await navigator.clipboard.writeText(household.id)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  async function handleCreateHousehold(e: React.FormEvent) {
    e.preventDefault()
    if (!createHouseholdName.trim()) return
    setHouseholdMessage(null)
    setHouseholdLoading(true)
    const { error } = await onCreateHousehold(createHouseholdName.trim())
    setHouseholdLoading(false)
    if (error) setHouseholdMessage({ type: 'error', text: String(error) })
    else {
      setHouseholdMessage({ type: 'success', text: language === 'es' ? 'Hogar creado.' : 'Household created.' })
      setCreateHouseholdName('')
      setCreateHouseholdOpen(false)
      setAddHouseholdOpen(false)
    }
  }

  async function handleJoinHouseholdSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = joinCode.trim()
    if (!id) return
    setHouseholdMessage(null)
    setHouseholdLoading(true)
    const { error } = await onJoinHousehold(id)
    setHouseholdLoading(false)
    if (error) setHouseholdMessage({ type: 'error', text: String(error) })
    else {
      setHouseholdMessage({ type: 'success', text: language === 'es' ? 'Te uniste al hogar.' : 'Joined household.' })
      setJoinCode('')
      setJoinHouseholdOpen(false)
      setAddHouseholdOpen(false)
    }
  }

  async function handleSaveHouseholdName() {
    setHouseholdNameSaveStatus('saving')
    const { error } = await onUpdateHouseholdName(household.id, householdName.trim())
    setHouseholdNameSaveStatus(error ? 'error' : 'saved')
    if (!error) setEditHouseholdNameOpen(false)
    setTimeout(() => setHouseholdNameSaveStatus('idle'), 2000)
  }

  return (
    <div className="settings-household">
      <div className="settings-household__section">
        <h3 className="settings-household__section-title">{ui('settings.household_settings', language)}</h3>
        {addHouseholdOpen ? (
          <div className="settings-household__add-flow">
            <button type="button" className="settings-household__back-link" onClick={() => { setAddHouseholdOpen(false); setCreateHouseholdOpen(false); setJoinHouseholdOpen(false); setHouseholdMessage(null); }}>
              {ui('places.back', language)}
            </button>
            {!createHouseholdOpen && !joinHouseholdOpen ? (
              <div className="settings-household__add-choices">
                <button type="button" className="settings-household__add-btn" onClick={() => { setCreateHouseholdOpen(true); setHouseholdMessage(null); }}>
                  {ui('settings.create_household', language)}
                </button>
                <button type="button" className="settings-household__add-btn" onClick={() => { setJoinHouseholdOpen(true); setHouseholdMessage(null); }}>
                  {ui('settings.join_with_code', language)}
                </button>
              </div>
            ) : createHouseholdOpen ? (
              <form onSubmit={handleCreateHousehold} className="settings-household__edit-form">
                <label className="settings-household__label">{ui('settings.household_name', language)}</label>
                <input type="text" className="settings-household__input" value={createHouseholdName} onChange={(e) => setCreateHouseholdName(e.target.value)} placeholder={ui('settings.household_name', language)} />
                {householdMessage && <p className={householdMessage.type === 'error' ? 'settings-household__error' : 'settings-household__success'}>{householdMessage.text}</p>}
                <div className="settings-household__form-actions">
                  <button type="button" className="settings-household__btn-secondary" onClick={() => { setCreateHouseholdOpen(false); setHouseholdMessage(null); }}>{ui('edit.cancel', language)}</button>
                  <button type="submit" className="settings-household__btn-primary" disabled={householdLoading}>{householdLoading ? '…' : ui('settings.save', language)}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleJoinHouseholdSubmit} className="settings-household__edit-form">
                <label className="settings-household__label">{ui('settings.invite_code_placeholder', language)}</label>
                <input type="text" className="settings-household__input" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder={ui('settings.invite_code_placeholder', language)} />
                {householdMessage && <p className={householdMessage.type === 'error' ? 'settings-household__error' : 'settings-household__success'}>{householdMessage.text}</p>}
                <div className="settings-household__form-actions">
                  <button type="button" className="settings-household__btn-secondary" onClick={() => { setJoinHouseholdOpen(false); setHouseholdMessage(null); }}>{ui('edit.cancel', language)}</button>
                  <button type="submit" className="settings-household__btn-primary" disabled={householdLoading}>{householdLoading ? '…' : ui('settings.save', language)}</button>
                </div>
              </form>
            )}
          </div>
        ) : editHouseholdNameOpen ? (
          <div className="settings-household__edit-form">
            <label className="settings-household__label">{ui('settings.household_name', language)}</label>
            <input type="text" className="settings-household__input" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} placeholder={ui('settings.household_name', language)} />
            <div className="settings-household__form-actions">
              <button type="button" className="settings-household__btn-secondary" onClick={() => { setEditHouseholdNameOpen(false); setHouseholdName(household.name); }}>{ui('edit.cancel', language)}</button>
              <button type="button" className="settings-household__btn-primary" onClick={handleSaveHouseholdName} disabled={householdNameSaveStatus === 'saving'}>
                {householdNameSaveStatus === 'saving' ? '…' : householdNameSaveStatus === 'saved' ? ui('settings.profile_saved', language) : ui('settings.save', language)}
              </button>
            </div>
          </div>
        ) : (
          <div className="settings-household__selector-row">
            <select
              className="settings-household__select"
              value={selectedId}
              onChange={(e) => {
                const v = e.target.value
                if (v === ADD_NEW_SENTINEL) setAddHouseholdOpen(true)
                else onSelectHousehold(v)
              }}
            >
              {households.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
              <option value={ADD_NEW_SENTINEL}>{ui('settings.add_household_option', language)}</option>
            </select>
            <button type="button" className="settings-household__edit-icon" onClick={() => setEditHouseholdNameOpen(true)} aria-label={ui('settings.edit_household_name', language)}>
              <Pencil size={16} />
            </button>
          </div>
        )}

        <h4 className="settings-household__subsection-title">{ui('settings.members', language)}</h4>
        {members.map((m) => {
          const label = m.display_name ?? m.email ?? m.user_id.slice(0, 12)
          const isYou = m.user_id === user.id
          return (
            <div key={m.user_id} className="settings-household__member">
              <span className="settings-household__member-name">
                {label}
                {isYou && <span className="settings-household__member-you"> {ui('settings.you', language)}</span>}
              </span>
              <span className="settings-household__member-role">
                {m.role === 'owner' ? ui('settings.owner', language) : ui('settings.member', language)}
              </span>
            </div>
          )
        })}

        <h4 className="settings-household__subsection-title">{ui('settings.invite_code', language)}</h4>
        <div className="settings-household__code-row">
          <span className="settings-household__code">{household.id}</span>
          <button className="settings-household__copy-btn" onClick={handleCopyCode}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? ui('settings.copied', language) : ui('settings.copy_code', language)}
          </button>
        </div>
      </div>
    </div>
  )
}

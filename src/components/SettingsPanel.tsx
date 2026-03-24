import { useState, useEffect } from 'react'
import { useBackHandler } from '../hooks/useBackHandler'
import { X, Copy, Check, LogOut, Pencil } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Clipboard } from '@capacitor/clipboard'
import { supabase } from '../supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'
import { useTheme } from '../theme/ThemeContext'
import { ui } from '../i18n/ui'
import type { Household, Profile } from '../types'
import type { User as AuthUser } from '@supabase/supabase-js'
import type { ProfileUpdate } from '../hooks/useProfile'
import './SettingsPanel.css'

interface SettingsPanelProps {
  user: AuthUser
  profile: Profile | null
  updateProfile: (updates: ProfileUpdate) => Promise<{ error?: unknown }>
  household: Household
  households: Household[]
  selectedId: string
  onSelectHousehold: (id: string) => void
  onCreateHousehold: (name: string) => Promise<{ error?: unknown }>
  onJoinHousehold: (householdId: string) => Promise<{ error?: unknown }>
  onUpdateHouseholdName: (householdId: string, name: string) => Promise<{ data?: Household; error?: unknown }>
  onClose: () => void
}

interface MemberInfo {
  user_id: string
  role: string
  email?: string
  display_name?: string | null
}

const ADD_NEW_SENTINEL = '__add_new__'

export function SettingsPanel({ user, profile, updateProfile, household, households, selectedId, onSelectHousehold, onCreateHousehold, onJoinHousehold, onUpdateHouseholdName, onClose }: SettingsPanelProps) {
  const { language, setLanguage } = useLanguage()
  const { theme, setTheme } = useTheme()
  useBackHandler(true, onClose)
  const [copied, setCopied] = useState(false)
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileSaveStatus, setProfileSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [passwordError, setPasswordError] = useState<string | null>(null)
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
    setDisplayName(profile?.display_name ?? '')
  }, [profile?.display_name])

  useEffect(() => {
    setHouseholdName(household.name)
  }, [household.name])

  const handleThemeChange = (mode: 'light' | 'dark' | 'system') => {
    setTheme(mode)
    updateProfile({ theme: mode }).catch(() => {})
  }

  const handleLanguageChange = (lang: 'en' | 'es') => {
    setLanguage(lang)
    updateProfile({ language: lang }).catch(() => {})
  }

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

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  async function handleSaveProfile() {
    setProfileSaveStatus('saving')
    const { error } = await updateProfile({ display_name: displayName || null })
    setProfileSaveStatus(error ? 'error' : 'saved')
    if (!error) setEditProfileOpen(false)
    setTimeout(() => setProfileSaveStatus('idle'), 2000)
  }

  async function handleChangePassword() {
    setPasswordError(null)
    if (newPassword !== confirmPassword) {
      setPasswordStatus('error')
      setPasswordError(language === 'es' ? 'Las contraseñas no coinciden' : 'Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPasswordStatus('error')
      setPasswordError(language === 'es' ? 'Mínimo 6 caracteres' : 'At least 6 characters')
      return
    }
    setPasswordStatus('loading')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordStatus('error')
      setPasswordError(error.message)
      return
    }
    setPasswordStatus('success')
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => {
      setChangePasswordOpen(false)
      setPasswordStatus('idle')
    }, 1500)
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
    <>
      <div className="settings-overlay" onClick={onClose} />
      <div className="settings-panel">
        <div className="settings-panel__header">
          <h2 className="settings-panel__title">{ui('settings.title', language)}</h2>
          <button className="settings-panel__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* 1. Profile */}
        <div className="settings-panel__section">
          <h3 className="settings-panel__section-title">{ui('settings.profile', language)}</h3>
          {!editProfileOpen ? (
            <div className="settings-panel__profile-row">
              <div className="settings-panel__profile-info">
                <p className="settings-panel__profile-name">{profile?.display_name?.trim() || '—'}</p>
                <p className="settings-panel__email">{user.email}</p>
              </div>
              <button
                type="button"
                className="settings-panel__profile-edit-icon"
                onClick={() => setEditProfileOpen(true)}
                aria-label={ui('settings.edit_profile', language)}
              >
                <Pencil size={16} />
              </button>
            </div>
          ) : (
            <div className="settings-panel__edit-form">
              <label className="settings-panel__label">{ui('settings.display_name', language)}</label>
              <input
                type="text"
                className="settings-panel__input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={ui('settings.display_name', language)}
              />
              <div className="settings-panel__form-actions">
                <button type="button" className="settings-panel__btn-secondary" onClick={() => setEditProfileOpen(false)}>
                  {ui('edit.cancel', language)}
                </button>
                <button type="button" className="settings-panel__btn-primary" onClick={handleSaveProfile} disabled={profileSaveStatus === 'saving'}>
                  {profileSaveStatus === 'saving' ? '…' : profileSaveStatus === 'saved' ? ui('settings.profile_saved', language) : ui('settings.save', language)}
                </button>
              </div>
            </div>
          )}
          {!changePasswordOpen ? (
            <button
              type="button"
              className="settings-panel__change-password-link"
              onClick={() => setChangePasswordOpen(true)}
            >
              {ui('settings.change_password', language)}
            </button>
          ) : (
            <div className="settings-panel__edit-form">
              <label className="settings-panel__label">{ui('settings.new_password', language)}</label>
              <input
                type="password"
                className="settings-panel__input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <label className="settings-panel__label">{ui('settings.confirm_password', language)}</label>
              <input
                type="password"
                className="settings-panel__input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              {passwordError && <p className="settings-panel__error">{passwordError}</p>}
              {passwordStatus === 'success' && <p className="settings-panel__success">{ui('settings.password_updated', language)}</p>}
              <div className="settings-panel__form-actions">
                <button type="button" className="settings-panel__btn-secondary" onClick={() => { setChangePasswordOpen(false); setPasswordError(null); setPasswordStatus('idle'); }}>
                  {ui('edit.cancel', language)}
                </button>
                <button type="button" className="settings-panel__btn-primary" onClick={handleChangePassword} disabled={passwordStatus === 'loading'}>
                  {passwordStatus === 'loading' ? '…' : ui('settings.save', language)}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Household (merged) */}
        <div className="settings-panel__section">
          <h3 className="settings-panel__section-title">{ui('settings.household_settings', language)}</h3>
          {addHouseholdOpen ? (
            <div className="settings-panel__add-household-flow">
              <button type="button" className="settings-panel__add-household-back" onClick={() => { setAddHouseholdOpen(false); setCreateHouseholdOpen(false); setJoinHouseholdOpen(false); setHouseholdMessage(null); }}>
                {ui('places.back', language)}
              </button>
              {!createHouseholdOpen && !joinHouseholdOpen ? (
                <div className="settings-panel__add-household">
                  <button type="button" className="settings-panel__add-household-btn" onClick={() => { setCreateHouseholdOpen(true); setHouseholdMessage(null); }}>
                    {ui('settings.create_household', language)}
                  </button>
                  <button type="button" className="settings-panel__add-household-btn" onClick={() => { setJoinHouseholdOpen(true); setHouseholdMessage(null); }}>
                    {ui('settings.join_with_code', language)}
                  </button>
                </div>
              ) : createHouseholdOpen ? (
                <form onSubmit={handleCreateHousehold} className="settings-panel__edit-form">
                  <label className="settings-panel__label">{ui('settings.household_name', language)}</label>
                  <input type="text" className="settings-panel__input" value={createHouseholdName} onChange={(e) => setCreateHouseholdName(e.target.value)} placeholder={ui('settings.household_name', language)} />
                  {householdMessage && <p className={householdMessage.type === 'error' ? 'settings-panel__error' : 'settings-panel__success'}>{householdMessage.text}</p>}
                  <div className="settings-panel__form-actions">
                    <button type="button" className="settings-panel__btn-secondary" onClick={() => { setCreateHouseholdOpen(false); setHouseholdMessage(null); }}>{ui('edit.cancel', language)}</button>
                    <button type="submit" className="settings-panel__btn-primary" disabled={householdLoading}>{householdLoading ? '…' : ui('settings.save', language)}</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleJoinHouseholdSubmit} className="settings-panel__edit-form">
                  <label className="settings-panel__label">{ui('settings.invite_code_placeholder', language)}</label>
                  <input type="text" className="settings-panel__input" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder={ui('settings.invite_code_placeholder', language)} />
                  {householdMessage && <p className={householdMessage.type === 'error' ? 'settings-panel__error' : 'settings-panel__success'}>{householdMessage.text}</p>}
                  <div className="settings-panel__form-actions">
                    <button type="button" className="settings-panel__btn-secondary" onClick={() => { setJoinHouseholdOpen(false); setHouseholdMessage(null); }}>{ui('edit.cancel', language)}</button>
                    <button type="submit" className="settings-panel__btn-primary" disabled={householdLoading}>{householdLoading ? '…' : ui('settings.save', language)}</button>
                  </div>
                </form>
              )}
            </div>
          ) : editHouseholdNameOpen ? (
            <div className="settings-panel__edit-form">
              <label className="settings-panel__label">{ui('settings.household_name', language)}</label>
              <input type="text" className="settings-panel__input" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} placeholder={ui('settings.household_name', language)} />
              <div className="settings-panel__form-actions">
                <button type="button" className="settings-panel__btn-secondary" onClick={() => { setEditHouseholdNameOpen(false); setHouseholdName(household.name); }}>{ui('edit.cancel', language)}</button>
                <button type="button" className="settings-panel__btn-primary" onClick={handleSaveHouseholdName} disabled={householdNameSaveStatus === 'saving'}>
                  {householdNameSaveStatus === 'saving' ? '…' : householdNameSaveStatus === 'saved' ? ui('settings.profile_saved', language) : ui('settings.save', language)}
                </button>
              </div>
            </div>
          ) : (
            <div className="settings-panel__household-row">
              <select
                className="settings-panel__select settings-panel__select--household"
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
              <button type="button" className="settings-panel__household-edit-icon" onClick={() => setEditHouseholdNameOpen(true)} aria-label={ui('settings.edit_household_name', language)}>
                <Pencil size={16} />
              </button>
            </div>
          )}
          <h4 className="settings-panel__subsection-title">{ui('settings.members', language)}</h4>
          {members.map((m) => {
            const label = m.display_name ?? m.email ?? m.user_id.slice(0, 12)
            const isYou = m.user_id === user.id
            return (
              <div key={m.user_id} className="settings-panel__member">
                <span className="settings-panel__member-email">
                  {label}
                  {isYou && <span className="settings-panel__member-you"> {ui('settings.you', language)}</span>}
                </span>
                <span className="settings-panel__member-role">
                  {m.role === 'owner' ? ui('settings.owner', language) : ui('settings.member', language)}
                </span>
              </div>
            )
          })}
          <h4 className="settings-panel__subsection-title">{ui('settings.invite_code', language)}</h4>
          <div className="settings-panel__code-row">
            <span className="settings-panel__code">{household.id}</span>
            <button className="settings-panel__copy-btn" onClick={handleCopyCode}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? ui('settings.copied', language) : ui('settings.copy_code', language)}
            </button>
          </div>
        </div>

        {/* 3. User Settings */}
        <div className="settings-panel__section settings-panel__section--user-settings">
          <h3 className="settings-panel__section-title">{ui('settings.user_settings', language)}</h3>
          <label className="settings-panel__label">{ui('settings.theme', language)}</label>
          <div className="settings-panel__theme-toggle">
            <button
              className={`settings-panel__theme-btn ${theme === 'light' ? 'settings-panel__theme-btn--active' : ''}`}
              onClick={() => handleThemeChange('light')}
            >
              {ui('settings.theme_light', language)}
            </button>
            <button
              className={`settings-panel__theme-btn ${theme === 'dark' ? 'settings-panel__theme-btn--active' : ''}`}
              onClick={() => handleThemeChange('dark')}
            >
              {ui('settings.theme_dark', language)}
            </button>
            <button
              className={`settings-panel__theme-btn ${theme === 'system' ? 'settings-panel__theme-btn--active' : ''}`}
              onClick={() => handleThemeChange('system')}
            >
              {ui('settings.theme_system', language)}
            </button>
          </div>
          <label className="settings-panel__label">{ui('settings.language', language)}</label>
          <div className="settings-panel__lang-toggle">
            <button
              className={`settings-panel__lang-btn ${language === 'en' ? 'settings-panel__lang-btn--active' : ''}`}
              onClick={() => handleLanguageChange('en')}
            >
              English
            </button>
            <button
              className={`settings-panel__lang-btn ${language === 'es' ? 'settings-panel__lang-btn--active' : ''}`}
              onClick={() => handleLanguageChange('es')}
            >
              Español
            </button>
          </div>
        </div>

        {/* 5. Logout */}
        <div className="settings-panel__section">
          <button className="settings-panel__signout" onClick={handleSignOut}>
            <LogOut size={16} />
            {ui('settings.sign_out', language)}
          </button>
        </div>
      </div>
    </>
  )
}

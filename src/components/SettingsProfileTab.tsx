import { useState, useEffect } from 'react'
import { LogOut, Pencil } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'
import { useTheme } from '../theme/ThemeContext'
import { ui } from '../i18n/ui'
import type { Profile } from '../types'
import type { User as AuthUser } from '@supabase/supabase-js'
import type { ProfileUpdate } from '../hooks/useProfile'
import './SettingsProfileTab.css'

interface SettingsProfileTabProps {
  user: AuthUser
  profile: Profile | null
  updateProfile: (updates: ProfileUpdate) => Promise<{ error?: unknown }>
}

export function SettingsProfileTab({ user, profile, updateProfile }: SettingsProfileTabProps) {
  const { language, setLanguage } = useLanguage()
  const { theme, setTheme } = useTheme()

  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [profileSaveStatus, setProfileSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '')
  }, [profile?.display_name])

  const handleThemeChange = (mode: 'light' | 'dark' | 'system') => {
    setTheme(mode)
    updateProfile({ theme: mode }).catch(() => {})
  }

  const handleLanguageChange = (lang: 'en' | 'es') => {
    setLanguage(lang)
    updateProfile({ language: lang }).catch(() => {})
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

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="settings-profile">
      {/* Profile */}
      <div className="settings-profile__section">
        <h3 className="settings-profile__section-title">{ui('settings.profile', language)}</h3>
        {!editProfileOpen ? (
          <div className="settings-profile__row">
            <div className="settings-profile__info">
              <p className="settings-profile__name">{profile?.display_name?.trim() || '—'}</p>
              <p className="settings-profile__email">{user.email}</p>
            </div>
            <button
              type="button"
              className="settings-profile__edit-icon"
              onClick={() => setEditProfileOpen(true)}
              aria-label={ui('settings.edit_profile', language)}
            >
              <Pencil size={16} />
            </button>
          </div>
        ) : (
          <div className="settings-profile__edit-form">
            <label className="settings-profile__label">{ui('settings.display_name', language)}</label>
            <input
              type="text"
              className="settings-profile__input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={ui('settings.display_name', language)}
            />
            <div className="settings-profile__form-actions">
              <button type="button" className="settings-profile__btn-secondary" onClick={() => setEditProfileOpen(false)}>
                {ui('edit.cancel', language)}
              </button>
              <button type="button" className="settings-profile__btn-primary" onClick={handleSaveProfile} disabled={profileSaveStatus === 'saving'}>
                {profileSaveStatus === 'saving' ? '…' : profileSaveStatus === 'saved' ? ui('settings.profile_saved', language) : ui('settings.save', language)}
              </button>
            </div>
          </div>
        )}
        {!changePasswordOpen ? (
          <button
            type="button"
            className="settings-profile__change-password-link"
            onClick={() => setChangePasswordOpen(true)}
          >
            {ui('settings.change_password', language)}
          </button>
        ) : (
          <div className="settings-profile__edit-form">
            <label className="settings-profile__label">{ui('settings.new_password', language)}</label>
            <input
              type="password"
              className="settings-profile__input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <label className="settings-profile__label">{ui('settings.confirm_password', language)}</label>
            <input
              type="password"
              className="settings-profile__input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {passwordError && <p className="settings-profile__error">{passwordError}</p>}
            {passwordStatus === 'success' && <p className="settings-profile__success">{ui('settings.password_updated', language)}</p>}
            <div className="settings-profile__form-actions">
              <button type="button" className="settings-profile__btn-secondary" onClick={() => { setChangePasswordOpen(false); setPasswordError(null); setPasswordStatus('idle'); }}>
                {ui('edit.cancel', language)}
              </button>
              <button type="button" className="settings-profile__btn-primary" onClick={handleChangePassword} disabled={passwordStatus === 'loading'}>
                {passwordStatus === 'loading' ? '…' : ui('settings.save', language)}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Appearance */}
      <div className="settings-profile__section">
        <h3 className="settings-profile__section-title">{ui('settings.theme', language)}</h3>
        <div className="settings-profile__toggle-row">
          <button
            className={`settings-profile__toggle-btn ${theme === 'light' ? 'settings-profile__toggle-btn--active' : ''}`}
            onClick={() => handleThemeChange('light')}
          >
            {ui('settings.theme_light', language)}
          </button>
          <button
            className={`settings-profile__toggle-btn ${theme === 'dark' ? 'settings-profile__toggle-btn--active' : ''}`}
            onClick={() => handleThemeChange('dark')}
          >
            {ui('settings.theme_dark', language)}
          </button>
          <button
            className={`settings-profile__toggle-btn ${theme === 'system' ? 'settings-profile__toggle-btn--active' : ''}`}
            onClick={() => handleThemeChange('system')}
          >
            {ui('settings.theme_system', language)}
          </button>
        </div>

        <label className="settings-profile__label" style={{ marginTop: 16 }}>{ui('settings.language', language)}</label>
        <div className="settings-profile__toggle-row">
          <button
            className={`settings-profile__toggle-btn ${language === 'en' ? 'settings-profile__toggle-btn--active' : ''}`}
            onClick={() => handleLanguageChange('en')}
          >
            English
          </button>
          <button
            className={`settings-profile__toggle-btn ${language === 'es' ? 'settings-profile__toggle-btn--active' : ''}`}
            onClick={() => handleLanguageChange('es')}
          >
            Español
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <div className="settings-profile__section">
        <button className="settings-profile__signout" onClick={handleSignOut}>
          <LogOut size={16} />
          {ui('settings.sign_out', language)}
        </button>
      </div>
    </div>
  )
}

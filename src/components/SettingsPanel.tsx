import { useState, useEffect } from 'react'
import { X, Copy, Check, LogOut, MapPin } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import { useHouseholdTags } from '../hooks/useHouseholdTags'
import { LocationsEditor } from './LocationsEditor'
import type { Household } from '../types'
import './SettingsPanel.css'

interface SettingsPanelProps {
  household: Household
  households: Household[]
  selectedId: string
  onSelectHousehold: (id: string) => void
  onClose: () => void
}

interface MemberInfo {
  user_id: string
  role: string
  email?: string
}

export function SettingsPanel({ household, households, selectedId, onSelectHousehold, onClose }: SettingsPanelProps) {
  const { language, setLanguage } = useLanguage()
  const [copied, setCopied] = useState(false)
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [showLocations, setShowLocations] = useState(false)
  const { tags, saveTag, updateTag, deleteTag } = useHouseholdTags(household.id)

  useEffect(() => {
    supabase
      .from('household_members')
      .select('user_id, role')
      .eq('household_id', household.id)
      .then(({ data }) => {
        setMembers(
          (data ?? []).map((m: Record<string, string>) => ({
            user_id: m.user_id,
            role: m.role,
          }))
        )
      })
  }, [household.id])

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(household.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (showLocations) {
    return (
      <>
        <div className="settings-overlay" onClick={onClose} />
        <div className="settings-panel">
          <LocationsEditor
            tags={tags}
            onSaveTag={saveTag}
            onUpdateTag={updateTag}
            onDeleteTag={deleteTag}
            onBack={() => setShowLocations(false)}
          />
        </div>
      </>
    )
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

        {/* Household info */}
        <div className="settings-panel__section">
          <h3 className="settings-panel__section-title">{ui('settings.household', language)}</h3>
          <p className="settings-panel__household-name">{household.name}</p>
          <p className="settings-panel__household-id">{household.id}</p>
        </div>

        {/* Members */}
        <div className="settings-panel__section">
          <h3 className="settings-panel__section-title">{ui('settings.members', language)}</h3>
          {members.map((m) => (
            <div key={m.user_id} className="settings-panel__member">
              <span className="settings-panel__member-email">{m.email ?? m.user_id.slice(0, 12)}</span>
              <span className="settings-panel__member-role">
                {m.role === 'owner' ? ui('settings.owner', language) : ui('settings.member', language)}
              </span>
            </div>
          ))}
        </div>

        {/* Invite code */}
        <div className="settings-panel__section">
          <h3 className="settings-panel__section-title">{ui('settings.invite_code', language)}</h3>
          <div className="settings-panel__code-row">
            <span className="settings-panel__code">{household.id}</span>
            <button className="settings-panel__copy-btn" onClick={handleCopyCode}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? ui('settings.copied', language) : ui('settings.copy_code', language)}
            </button>
          </div>
        </div>

        {/* Switch household */}
        {households.length > 1 && (
          <div className="settings-panel__section">
            <h3 className="settings-panel__section-title">{ui('settings.switch_household', language)}</h3>
            <select
              className="settings-panel__select"
              value={selectedId}
              onChange={(e) => {
                onSelectHousehold(e.target.value)
                onClose()
              }}
            >
              {households.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Language */}
        <div className="settings-panel__section">
          <h3 className="settings-panel__section-title">{ui('settings.language', language)}</h3>
          <div className="settings-panel__lang-toggle">
            <button
              className={`settings-panel__lang-btn ${language === 'en' ? 'settings-panel__lang-btn--active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              English
            </button>
            <button
              className={`settings-panel__lang-btn ${language === 'es' ? 'settings-panel__lang-btn--active' : ''}`}
              onClick={() => setLanguage('es')}
            >
              Español
            </button>
          </div>
        </div>

        {/* Manage locations */}
        <div className="settings-panel__section">
          <button className="settings-panel__manage-locations" onClick={() => setShowLocations(true)}>
            <MapPin size={16} />
            {ui('settings.manage_locations', language)}
          </button>
        </div>

        {/* Sign out */}
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

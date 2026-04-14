import { useState, useEffect } from 'react'
import { ChevronDown, User, Home, SlidersHorizontal } from 'lucide-react'
import { useLanguage } from '../../../i18n/LanguageContext'
import { ui } from '../../../i18n/ui'
import { SettingsProfileTab } from './components/SettingsProfileTab'
import { SettingsHouseholdTab } from './components/SettingsHouseholdTab'
import { CustomFieldsManager } from './components/CustomFieldsManager'
import type { Household, Profile } from '../../../types'
import type { User as AuthUser } from '@supabase/supabase-js'
import type { ProfileUpdate } from '../../../hooks/useProfile'
import './SettingsView.css'

type SettingsSection = 'profile' | 'household' | 'custom_fields'

interface SettingsViewProps {
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
}

const sections: { key: SettingsSection; labelKey: string; icon: typeof User }[] = [
  { key: 'profile', labelKey: 'settings.profile', icon: User },
  { key: 'household', labelKey: 'settings.household', icon: Home },
  { key: 'custom_fields', labelKey: 'settings.custom_fields', icon: SlidersHorizontal },
]

export function SettingsView({ user, profile, updateProfile, household, households, selectedId, onSelectHousehold, onCreateHousehold, onJoinHousehold, onUpdateHouseholdName }: SettingsViewProps) {
  const { language } = useLanguage()

  const [activeSection, setActiveSection] = useState<SettingsSection | null>(() => {
    return window.matchMedia('(min-width: 1024px)').matches ? 'profile' : null
  })

  const [isDesktop, setIsDesktop] = useState(() =>
    window.matchMedia('(min-width: 1024px)').matches
  )

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches)
      if (e.matches && !activeSection) {
        setActiveSection('profile')
      }
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [activeSection])

  const showSection = activeSection ?? 'profile'

  function renderSectionContent(key: SettingsSection) {
    switch (key) {
      case 'profile':
        return <SettingsProfileTab user={user} profile={profile} updateProfile={updateProfile} />
      case 'household':
        return (
          <SettingsHouseholdTab
            user={user}
            household={household}
            households={households}
            selectedId={selectedId}
            onSelectHousehold={onSelectHousehold}
            onCreateHousehold={onCreateHousehold}
            onJoinHousehold={onJoinHousehold}
            onUpdateHouseholdName={onUpdateHouseholdName}
          />
        )
      case 'custom_fields':
        return (
          <div className="settings-view__cf-wrapper">
            <CustomFieldsManager />
          </div>
        )
    }
  }

  function toggleSection(key: SettingsSection) {
    setActiveSection(prev => prev === key ? null : key)
  }

  // Mobile: accordion
  if (!isDesktop) {
    return (
      <div className="settings-view">
        <div className="settings-view__header">
          <h1 className="settings-view__title">{ui('settings.title', language)}</h1>
        </div>
        <div className="settings-view__accordion">
          {sections.map(({ key, labelKey, icon: Icon }) => {
            const isOpen = activeSection === key
            return (
              <div key={key} className="settings-view__accordion-item">
                <button
                  className={`settings-view__accordion-header ${isOpen ? 'settings-view__accordion-header--open' : ''}`}
                  onClick={() => toggleSection(key)}
                >
                  <Icon size={18} className="settings-view__accordion-icon" />
                  <span className="settings-view__accordion-label">{ui(labelKey, language)}</span>
                  <ChevronDown size={16} className={`settings-view__accordion-chevron ${isOpen ? 'settings-view__accordion-chevron--open' : ''}`} />
                </button>
                <div className={`settings-view__accordion-body ${isOpen ? 'settings-view__accordion-body--open' : ''}`}>
                  <div className="settings-view__accordion-body-inner">
                    {renderSectionContent(key)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Desktop: tab bar
  return (
    <div className="settings-view">
      <div className="settings-view__tabs">
        {sections.map(({ key, labelKey }) => (
          <button
            key={key}
            className={`settings-view__tab ${activeSection === key ? 'settings-view__tab--active' : ''}`}
            onClick={() => setActiveSection(key)}
          >
            {ui(labelKey, language)}
          </button>
        ))}
      </div>
      <div className="settings-view__content">
        {renderSectionContent(showSection)}
      </div>
    </div>
  )
}

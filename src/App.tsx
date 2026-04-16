import { useState, useCallback, useEffect, useRef } from 'react'
import { initBackNavigation } from './lib/backNavigation'
import { useAuth } from './hooks/useAuth'
import { useHousehold } from './hooks/useHousehold'
import { useProfile } from './hooks/useProfile'
import { LanguageProvider, useLanguage } from './i18n/LanguageContext'
import { ThemeProvider, useTheme } from './theme/ThemeContext'
import { ToastProvider } from './toast/ToastContext'
import { CustomFieldsProvider } from './hooks/CustomFieldsContext'
import type { ThemeMode } from './theme/ThemeContext'
import type { Lang } from './i18n/picklists'
import { LandingPage } from './components/layout/LandingPage'
import { HouseholdSelect } from './components/layout/HouseholdSelect'
import { Sidebar } from './components/layout/Sidebar'
import { BottomNav, type NavTab } from './components/layout/BottomNav'
import { ChatView } from './components/views/chat/ChatView'
import { InventoryView } from './components/views/inventory/InventoryView'
import { LocationsView } from './components/views/locations/LocationsView'
import { ActivityView } from './components/views/activity/ActivityView'
import { SettingsView } from './components/views/settings/SettingsView'
import { ui } from './i18n/ui'
import type { LocationRef, HistoryEntityType } from './types'
import './App.css'

function AppInner() {
  const { user, loading: authLoading, isRecovery, clearRecovery } = useAuth()
  const {
    households,
    selectedId,
    selectedHousehold,
    setSelectedId,
    createHousehold,
    joinHousehold,
    updateHouseholdName,
    loading: householdLoading,
  } = useHousehold(user?.id)
  const { profile, updateProfile, loading: profileLoading } = useProfile(user?.id)
  const { setTheme } = useTheme()
  const { language, setLanguage } = useLanguage()
  const syncedProfileRef = useRef<string | null>(null)

  const [activeTab, setActiveTab] = useState<NavTab>('items')
  const [itemsFilter, setItemsFilter] = useState<LocationRef | null>(null)
  const [highlightEntity, setHighlightEntity] = useState<{ type: HistoryEntityType; id: string } | null>(null)
  // Initialize back-button navigation
  useEffect(() => { initBackNavigation() }, [])

  // Sync theme/language from profile when profile loads (once per user)
  useEffect(() => {
    if (profileLoading || !user || !profile || syncedProfileRef.current === user.id) return
    syncedProfileRef.current = user.id
    if (profile.theme && ['light', 'dark', 'system'].includes(profile.theme)) {
      setTheme(profile.theme as ThemeMode)
    }
    if (profile.language && (profile.language === 'en' || profile.language === 'es')) {
      setLanguage(profile.language as Lang)
    }
  }, [profileLoading, user, profile, setTheme, setLanguage])

  const handleNavigateToItems = useCallback((filter: LocationRef) => {
    setItemsFilter(filter)
    setActiveTab('items')
  }, [])

  const handleNavigateToEntity = useCallback((entityType: HistoryEntityType, entityId: string) => {
    setHighlightEntity({ type: entityType, id: entityId })
    setActiveTab(entityType === 'storage_entry' ? 'items' : 'locations')
  }, [])

  const handleTabNavigate = useCallback((tab: NavTab) => {
    if (tab === 'items' && activeTab === 'items') {
      setItemsFilter(null)
    }
    setActiveTab(tab)
  }, [activeTab])

  if (authLoading) {
    return (
      <div className="app app--loading">
        <p>{ui('common.loading', language)}</p>
      </div>
    )
  }

  if (!user) {
    return <LandingPage />
  }

  if (isRecovery) {
    return <LandingPage recoveryMode onRecoveryComplete={clearRecovery} />
  }

  const needsHousehold = !householdLoading && households.length === 0
  const hasHousehold = selectedHousehold && selectedId

  if (needsHousehold) {
    return (
      <div className="app">
        <HouseholdSelect
          households={households}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={async (name) => {
            const result = await createHousehold(name)
            return { error: result.error }
          }}
          onJoin={async (householdId) => {
            const result = await joinHousehold(householdId)
            return { error: result.error }
          }}
        />
      </div>
    )
  }

  if (!hasHousehold && (householdLoading || (households.length > 0 && !selectedId))) {
    return (
      <div className="app app--loading">
        <p>{ui('common.loading', language)}</p>
      </div>
    )
  }

  return (
    <CustomFieldsProvider householdId={selectedId!}>
    <div className="app app--main">
      <Sidebar active={activeTab} onNavigate={handleTabNavigate} />
      <div className="app__body">
        <main className="app__content">
          {activeTab === 'chat' && selectedId && (
            <ChatView householdId={selectedId} onNavigateToItems={handleNavigateToItems} />
          )}
          {activeTab === 'items' && selectedId && (
            <InventoryView householdId={selectedId} filter={itemsFilter} onClearFilter={() => setItemsFilter(null)} highlightEntity={highlightEntity} onClearHighlight={() => setHighlightEntity(null)} />
          )}
          {activeTab === 'locations' && selectedId && (
            <LocationsView householdId={selectedId} onNavigateToItems={handleNavigateToItems} highlightEntity={highlightEntity} onClearHighlight={() => setHighlightEntity(null)} />
          )}
          {activeTab === 'activity' && selectedId && (
            <ActivityView householdId={selectedId} onNavigateToEntity={handleNavigateToEntity} />
          )}
          {activeTab === 'settings' && selectedHousehold && selectedId && (
            <SettingsView
              user={user}
              profile={profile}
              updateProfile={updateProfile}
              household={selectedHousehold}
              households={households}
              selectedId={selectedId}
              onSelectHousehold={setSelectedId}
              onCreateHousehold={async (name) => {
                const result = await createHousehold(name)
                return { error: result.error }
              }}
              onJoinHousehold={async (householdId) => {
                const result = await joinHousehold(householdId)
                return { error: result.error }
              }}
              onUpdateHouseholdName={async (householdId, name) => {
                const result = await updateHouseholdName(householdId, name)
                return { data: result.data ?? undefined, error: result.error }
              }}
            />
          )}
        </main>
        <BottomNav active={activeTab} onNavigate={handleTabNavigate} />
      </div>
    </div>
    </CustomFieldsProvider>
  )
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <AppInner />
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}

export default App

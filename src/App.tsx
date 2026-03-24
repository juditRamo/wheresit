import { useState, useCallback, useEffect, useRef } from 'react'
import { initBackNavigation } from './lib/backNavigation'
import { useBackHandler } from './hooks/useBackHandler'
import { useAuth } from './hooks/useAuth'
import { useHousehold } from './hooks/useHousehold'
import { useProfile } from './hooks/useProfile'
import { LanguageProvider, useLanguage } from './i18n/LanguageContext'
import { ThemeProvider, useTheme } from './theme/ThemeContext'
import type { ThemeMode } from './theme/ThemeContext'
import type { Lang } from './i18n/picklists'
import { Auth } from './components/Auth'
import { HouseholdSelect } from './components/HouseholdSelect'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { BottomNav, type NavTab } from './components/BottomNav'
import { Chat } from './components/Chat'
import { InventoryView } from './components/InventoryView'
import { LocationsView } from './components/LocationsView'
import { SettingsPanel } from './components/SettingsPanel'
import type { LocationRef } from './types'
import './App.css'

function AppInner() {
  const { user, loading: authLoading } = useAuth()
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
  const { setLanguage } = useLanguage()
  const syncedProfileRef = useRef<string | null>(null)

  const [activeTab, setActiveTab] = useState<NavTab>('items')
  const [itemsFilter, setItemsFilter] = useState<LocationRef | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Initialize back-button navigation
  useEffect(() => { initBackNavigation() }, [])
  useBackHandler(settingsOpen, () => setSettingsOpen(false))

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

  const handleTabNavigate = useCallback((tab: NavTab) => {
    if (tab === 'items' && activeTab === 'items') {
      setItemsFilter(null)
    }
    setActiveTab(tab)
  }, [activeTab])

  if (authLoading) {
    return (
      <div className="app app--loading">
        <p>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Auth />
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
        <p>Loading household…</p>
      </div>
    )
  }

  return (
    <div className="app app--main">
      <Sidebar active={activeTab} onNavigate={handleTabNavigate} onSettingsClick={() => setSettingsOpen(true)} />
      <div className="app__body">
        <Header onMenuClick={() => setSettingsOpen(true)} />
        <main className="app__content">
          {activeTab === 'chat' && selectedId && (
            <Chat householdId={selectedId} onNavigateToItems={handleNavigateToItems} />
          )}
          {activeTab === 'items' && selectedId && (
            <InventoryView householdId={selectedId} filter={itemsFilter} onClearFilter={() => setItemsFilter(null)} />
          )}
          {activeTab === 'locations' && selectedId && (
            <LocationsView householdId={selectedId} onNavigateToItems={handleNavigateToItems} />
          )}
        </main>
        <BottomNav active={activeTab} onNavigate={handleTabNavigate} onSettingsClick={() => setSettingsOpen(true)} />
      </div>

      {settingsOpen && selectedHousehold && selectedId && (
        <SettingsPanel
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
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppInner />
      </LanguageProvider>
    </ThemeProvider>
  )
}

export default App

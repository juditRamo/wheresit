import { useState, useCallback } from 'react'
import { useAuth } from './hooks/useAuth'
import { useHousehold } from './hooks/useHousehold'
import { LanguageProvider } from './i18n/LanguageContext'
import { ThemeProvider } from './theme/ThemeContext'
import { Auth } from './components/Auth'
import { HouseholdSelect } from './components/HouseholdSelect'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { BottomNav, type NavTab } from './components/BottomNav'
import { Chat } from './components/Chat'
import { InventoryView } from './components/InventoryView'
import { LocationsView } from './components/LocationsView'
import { SearchView } from './components/SearchView'
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
    loading: householdLoading,
  } = useHousehold(user?.id)

  const [activeTab, setActiveTab] = useState<NavTab>('chat')
  const [itemsFilter, setItemsFilter] = useState<LocationRef | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
          {activeTab === 'search' && selectedId && (
            <SearchView householdId={selectedId} onNavigateToItems={handleNavigateToItems} />
          )}
        </main>
        <BottomNav active={activeTab} onNavigate={handleTabNavigate} />
      </div>

      {settingsOpen && selectedHousehold && selectedId && (
        <SettingsPanel
          household={selectedHousehold}
          households={households}
          selectedId={selectedId}
          onSelectHousehold={setSelectedId}
          onClose={() => setSettingsOpen(false)}
          onNavigateToLocations={() => { setActiveTab('locations'); setSettingsOpen(false); }}
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

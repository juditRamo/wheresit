import { useAuth } from './hooks/useAuth'
import { useHousehold } from './hooks/useHousehold'
import { Auth } from './components/Auth'
import { HouseholdSelect } from './components/HouseholdSelect'
import { Chat } from './components/Chat'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
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

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

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
    <div className="app app--chat">
      <header className="app__header">
        <h1 className="app__title">WheresIt</h1>
        <div className="app__header-actions">
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
          <button type="button" onClick={handleSignOut} className="app__sign-out">
            Sign out
          </button>
        </div>
      </header>
      <main className="app__main">
        {selectedId && <Chat householdId={selectedId} />}
      </main>
    </div>
  )
}

export default App

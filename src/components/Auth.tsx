import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import './Auth.css'

type Mode = 'signin' | 'signup'

export function Auth() {
  const { language } = useLanguage()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setMessage({ type: 'error', text: error.message })
        else setMessage({ type: 'success', text: ui('auth.confirm_email', language) })
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setMessage({ type: 'error', text: error.message })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <h1>{mode === 'signin' ? ui('auth.title_signin', language) : ui('auth.title_signup', language)}</h1>
        <p className="auth-subtitle">{ui('auth.subtitle', language)}</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="email"
            placeholder={ui('auth.email', language)}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <div className="auth-password-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={ui('auth.password', language)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {message && (
            <p className={`auth-message auth-message--${message.type}`}>{message.text}</p>
          )}
          <button type="submit" disabled={loading}>
            {loading ? '…' : mode === 'signin' ? ui('auth.signin', language) : ui('auth.signup', language)}
          </button>
        </form>
        <button
          type="button"
          className="auth-toggle"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setMessage(null)
          }}
        >
          {mode === 'signin' ? ui('auth.toggle_signup', language) : ui('auth.toggle_signin', language)}
        </button>
      </div>
    </div>
  )
}

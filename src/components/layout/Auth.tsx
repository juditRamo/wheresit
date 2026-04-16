import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { useLanguage } from '../../i18n/LanguageContext'
import { ui } from '../../i18n/ui'
import './Auth.css'

type Mode = 'signin' | 'signup' | 'forgot' | 'reset_password'

interface AuthProps {
  recoveryMode?: boolean
  onRecoveryComplete?: () => void
}

export function Auth({ recoveryMode, onRecoveryComplete }: AuthProps) {
  const { language } = useLanguage()
  const [mode, setMode] = useState<Mode>(recoveryMode ? 'reset_password' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (recoveryMode) setMode('reset_password')
  }, [recoveryMode])

  const titles: Record<Mode, string> = {
    signin: ui('auth.title_signin', language),
    signup: ui('auth.title_signup', language),
    forgot: ui('auth.reset_title', language),
    reset_password: ui('auth.new_password_title', language),
  }

  const subtitles: Record<Mode, string> = {
    signin: ui('auth.subtitle', language),
    signup: ui('auth.subtitle', language),
    forgot: ui('auth.reset_subtitle', language),
    reset_password: ui('auth.new_password_subtitle', language),
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) setMessage({ type: 'error', text: error.message })
        else setMessage({ type: 'success', text: ui('auth.reset_sent', language) })
      } else if (mode === 'reset_password') {
        if (password.length < 6) {
          setMessage({ type: 'error', text: ui('settings.password_too_short', language) })
          return
        }
        if (password !== confirmPassword) {
          setMessage({ type: 'error', text: ui('settings.password_mismatch', language) })
          return
        }
        const { error } = await supabase.auth.updateUser({ password })
        if (error) {
          setMessage({ type: 'error', text: error.message })
        } else {
          setMessage({ type: 'success', text: ui('auth.password_updated', language) })
          setTimeout(() => onRecoveryComplete?.(), 1500)
        }
      } else if (mode === 'signup') {
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
        <h1>{titles[mode]}</h1>
        <p className="auth-subtitle">{subtitles[mode]}</p>
        <form onSubmit={handleSubmit} className="auth-form">
          {mode !== 'reset_password' && (
            <input
              className="input-field"
              type="email"
              placeholder={ui('auth.email', language)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          )}
          {(mode === 'signin' || mode === 'signup') && (
            <>
              <div className="auth-password-wrap">
                <input
                  className="input-field"
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
                  aria-label={showPassword ? ui('auth.hide_password', language) : ui('auth.show_password', language)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {mode === 'signin' && (
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => { setMode('forgot'); setMessage(null) }}
                >
                  {ui('auth.forgot_password', language)}
                </button>
              )}
            </>
          )}
          {mode === 'reset_password' && (
            <>
              <div className="auth-password-wrap">
                <input
                  className="input-field"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={ui('settings.new_password', language)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={6}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? ui('auth.hide_password', language) : ui('auth.show_password', language)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <input
                className="input-field"
                type="password"
                placeholder={ui('auth.password_confirm', language)}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={6}
              />
            </>
          )}
          {message && (
            <p className={`auth-message auth-message--${message.type}`}>{message.text}</p>
          )}
          <button type="submit" className="btn-ghost-gold" disabled={loading}>
            {loading
              ? '…'
              : mode === 'signin'
                ? ui('auth.signin', language)
                : mode === 'signup'
                  ? ui('auth.signup', language)
                  : mode === 'forgot'
                    ? ui('auth.send_reset', language)
                    : ui('auth.new_password_title', language)}
          </button>
        </form>
        {mode === 'forgot' && (
          <button
            type="button"
            className="auth-toggle"
            onClick={() => { setMode('signin'); setMessage(null) }}
          >
            {ui('auth.back_to_signin', language)}
          </button>
        )}
        {(mode === 'signin' || mode === 'signup') && (
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
        )}
      </div>
    </div>
  )
}

import { useContext, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'
import { ToastContext } from './context'
import type { Toast } from './context'
import './Toast.css'

const DURATIONS: Record<Toast['type'], number> = {
  success: 3000,
  info: 4000,
  error: 6000,
}

const ICONS: Record<Toast['type'], typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const EXIT_MS = 200

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false)

  const dismiss = useCallback(() => {
    if (exiting) return
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), EXIT_MS)
  }, [exiting, onDismiss, toast.id])

  useEffect(() => {
    const timer = setTimeout(dismiss, DURATIONS[toast.type])
    return () => clearTimeout(timer)
  }, [dismiss, toast.type])

  const Icon = ICONS[toast.type]

  return (
    <div
      className={`toast toast--${toast.type}${exiting ? ' toast--exit' : ''}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      onClick={dismiss}
    >
      <Icon className="toast__icon" size={18} />
      <span className="toast__message">{toast.message}</span>
    </div>
  )
}

export function ToastContainer() {
  const ctx = useContext(ToastContext)
  if (!ctx) return null

  const { toasts, dismissToast } = ctx

  if (toasts.length === 0) return null

  return createPortal(
    <div className="toast-container" aria-live="polite">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>,
    document.body,
  )
}

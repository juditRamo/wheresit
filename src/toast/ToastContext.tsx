import { useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { ToastContext } from './context'
import type { Toast, ToastType } from './context'
import { ToastContainer } from './ToastContainer'

const MAX_TOASTS = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    setToasts(prev => [{ id, type, message }, ...prev].slice(0, MAX_TOASTS))
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const value = useMemo(() => ({ toasts, addToast, dismissToast }), [toasts, addToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')

  const { addToast } = ctx

  const toast = useMemo(() => ({
    success: (message: string) => addToast('success', message),
    error: (message: string) => addToast('error', message),
    info: (message: string) => addToast('info', message),
  }), [addToast])

  return { toast }
}

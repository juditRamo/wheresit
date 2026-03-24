import { useEffect, useRef } from 'react'
import { pushHandler, removeHandler } from '../lib/backNavigation'

let nextId = 0

export function useBackHandler(active: boolean, handler: () => void) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  const idRef = useRef<string | null>(null)

  useEffect(() => {
    if (active) {
      const id = `back-handler-${++nextId}`
      idRef.current = id
      pushHandler(id, () => handlerRef.current())
      return () => {
        if (idRef.current === id) {
          removeHandler(id)
          idRef.current = null
        }
      }
    }
  }, [active])
}

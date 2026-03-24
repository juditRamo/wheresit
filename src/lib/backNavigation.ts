import { Capacitor } from '@capacitor/core'

interface HandlerEntry {
  id: string
  handler: () => void
}

const handlerStack: HandlerEntry[] = []
let ignoreNextPop = false
let initialized = false

function onPopState() {
  if (ignoreNextPop) {
    ignoreNextPop = false
    return
  }
  const entry = handlerStack.pop()
  if (entry) {
    entry.handler()
  }
}

async function onNativeBack() {
  if (handlerStack.length > 0) {
    history.back()
  } else {
    const { App } = await import('@capacitor/app')
    App.exitApp()
  }
}

export function initBackNavigation() {
  if (initialized) return
  initialized = true
  window.addEventListener('popstate', onPopState)
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', onNativeBack)
    })
  }
}

export function pushHandler(id: string, handler: () => void) {
  history.pushState({ backHandler: id }, '')
  handlerStack.push({ id, handler })
}

export function removeHandler(id: string) {
  const index = handlerStack.findIndex((e) => e.id === id)
  if (index === -1) return
  handlerStack.splice(index, 1)
  ignoreNextPop = true
  history.back()
}

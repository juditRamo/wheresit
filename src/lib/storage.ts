import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const isNative = Capacitor.isNativePlatform()

export async function getItem(key: string): Promise<string | null> {
  if (isNative) {
    const { value } = await Preferences.get({ key })
    return value
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isNative) {
    await Preferences.set({ key, value })
  } else {
    try {
      localStorage.setItem(key, value)
    } catch { /* ignore */ }
  }
}

export async function removeItem(key: string): Promise<void> {
  if (isNative) {
    await Preferences.remove({ key })
  } else {
    try {
      localStorage.removeItem(key)
    } catch { /* ignore */ }
  }
}

import type { QueryResult } from '../../../types'

export function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function buildResultLocation(r: QueryResult): string {
  return r.location_description
}

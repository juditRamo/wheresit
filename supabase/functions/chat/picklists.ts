// Chat picklists: minimal exports for composite pattern (no fixed room/spot/detail lists)

/** Build canonical key from location path for matching */
export function buildCanonicalKey(path: Array<{ type: string; label: string; attributes?: Record<string, string> }>): string {
  return path
    .map((p) => {
      const base = `${p.type}:${p.label.toLowerCase().replace(/\s+/g, '_')}`
      const attrs = p.attributes ? Object.entries(p.attributes).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}:${String(v).toLowerCase().replace(/\s+/g, '_')}`).join('_') : ''
      return attrs ? `${base}_${attrs}` : base
    })
    .join(':')
}

/** Build human-readable location string from path (labels joined by ›) */
export function buildLocationDescFromPath(path: Array<{ type: string; label: string; attributes?: Record<string, string> }>): string {
  return path
    .map((p) => {
      const attrs = p.attributes ? ' ' + Object.entries(p.attributes).map(([k, v]) => `${k}: ${v}`).join(', ') : ''
      return `${p.label}${attrs}`
    })
    .join(' › ')
}

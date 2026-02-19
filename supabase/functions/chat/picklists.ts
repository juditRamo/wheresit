// Chat picklists: minimal exports for composite pattern (no fixed room/spot/detail lists)

export interface LocationPathSegment {
  type: string
  label: string
  attributes?: Record<string, string>
}

export interface NormalizedLocation {
  location_path: LocationPathSegment[]
  canonical_key: string
}

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

/**
 * Parse location description into path without LLM. Handles:
 * - "X de la Y", "X del Y", "X of the Y" → segments [Y, X] (root to leaf)
 * - Simple single place: "the drawer" → [drawer]
 * Returns null if parsing yields no useful segments.
 */
export function normalizeLocationHeuristic(description: string): NormalizedLocation | null {
  const trimmed = description.trim()
  if (!trimmed) return null

  const typeFor = (label: string): string => {
    const l = label.toLowerCase()
    if (/\b(drawer|cajón|cajon)\b/.test(l)) return 'drawer'
    if (/\b(desk|escritorio)\b/.test(l)) return 'desk'
    if (/\b(table|mesa)\b/.test(l)) return 'table'
    if (/\b(box|caja)\b/.test(l)) return 'box'
    if (/\b(shelf|estante)\b/.test(l)) return 'shelf'
    if (/\b(room|despacho|office|oficina|living|sala)\b/.test(l)) return 'room'
    if (/\b(furniture|cajonera|comoda)\b/.test(l)) return 'furniture'
    return 'place'
  }

  const parts: string[] = []
  const rest = trimmed
    .split(/(?:\s+(?:de\s+la|del|de\s+el|of\s+the|in\s+the)\s+)/gi)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (rest.length === 0) return null

  for (let i = rest.length - 1; i >= 0; i--) {
    parts.push(rest[i])
  }

  if (parts.length === 0) return null

  const path: LocationPathSegment[] = parts.map((label) => ({
    type: typeFor(label),
    label: label.trim(),
  }))
  const canonical_key = buildCanonicalKey(path)
  return { location_path: path, canonical_key }
}

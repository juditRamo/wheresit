/**
 * Shared utilities for chat function: normalization, embeddings, label fixing.
 */

/** Normalize item names for storage: lowercase, trim, collapse whitespace. Used for deduplication. */
export function normalizeItem(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Normalize concept labels for comparison: lowercase, NFD, strip diacritics and non-alphanumeric. */
export function canonicalizeConceptLabel(input: string | undefined | null): string {
  if (!input) return ''
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Format embedding array as PostgreSQL vector literal, e.g. [0.1,-0.2,...]. Used in match_item_concepts RPC. */
export function embeddingToVectorLiteral(values: number[]): string {
  const trimmed = values.map((value) => {
    if (!Number.isFinite(value)) return 0
    return Number(value.toFixed(6))
  })
  return `[${trimmed.join(',')}]`
}

/**
 * Extract location phrases from user message (e.g. "segundo cajón", "cajonera", "despacho de Judit").
 * Uses regex for patterns like "en el/la", "del/de la", "in the". Used to fix LLM labels to match user wording.
 */
export function extractLocationPhrasesFromMessage(message: string): string[] {
  const parts: string[] = []
  const re = /(?:en el |en la |del |de la |de el |in the |in a )(.+?)(?=\s+de la |\s+del |\s+están|\s+está|\s+is |\s+are |,|$)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(message)) !== null) {
    const phrase = m[1].trim()
    if (phrase && phrase.length > 1) parts.push(phrase)
  }
  return parts
}

/** Replace LLM-generated labels with exact user phrases when counts match (root-to-leaf). Prevents LLM from translating/synonymizing. */
export function fixLabelsFromMessage<T extends { label: string }>(path: T[], message: string): T[] {
  const phrases = extractLocationPhrasesFromMessage(message)
  if (phrases.length !== path.length) return path
  const rootToLeaf = phrases.reverse()
  return path.map((seg, i) => ({
    ...seg,
    label: rootToLeaf[i] ?? seg.label,
  }))
}

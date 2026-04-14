/**
 * Intent classification: regex-first, LLM fallback only when needed.
 * Reduces Gemini calls for obvious patterns (STORE, QUERY, QUERY_LOCATION, DESCRIBE_PLACE).
 */

import { fixLabelsFromMessage } from './utils.ts'

export type Lang = 'en' | 'es'

export interface LocationPathSegment {
  type: string
  label: string
}

export interface LLMIntent {
  intent: 'STORE' | 'QUERY' | 'QUERY_LOCATION' | 'DESCRIBE_PLACE' | 'OTHER'
  language: Lang
  item_name?: string
  category?: string
  query_item?: string
  query_location?: string
  location_path?: LocationPathSegment[]
  location_paths?: LocationPathSegment[][]
  matched_place_id?: string | null
}

export interface IntentRegexResult {
  intent: LLMIntent
  confidence: 'high' | 'medium' | 'low'
}

/** Detect language from message content (Spanish vs English heuristics). */
function detectLanguage(message: string): Lang {
  const lower = message.toLowerCase()
  const isSpanish = /(?:dejé|guardé|puse|dónde|está|están|por favor|tengo|las?|los?|el\s|en\s(?:el|la|los|las)|hay|qué|tiene|del\s|de la\s)/.test(lower)
  return isSpanish ? 'es' : 'en'
}

/**
 * Classify intent using regex only. Returns OTHER with low confidence when no pattern matches.
 * Call classifyIntentLLM when confidence is low or intent is OTHER.
 */
export function classifyIntentRegex(message: string): IntentRegexResult {
  const lang = detectLanguage(message)
  const lower = message.toLowerCase().trim()

  // QUERY: "where is X" / "dónde está X"
  const queryMatchEn = lower.match(/\bwhere\s+(?:is|are)\s+(?:the\s+|my\s+)?(.+?)\??$/i)
  const queryMatchEs = lower.match(/(?:dónde|donde)\s+(?:está|están|dejé|guardé|puse)\s+(?:el|la|los|las|mi|mis)?\s*(.+?)\??$/i)
  const queryMatch = queryMatchEn || queryMatchEs
  if (queryMatch) {
    const q = queryMatch[1].trim()
    if (q && q.length > 0) {
      return {
        intent: { intent: 'QUERY', language: lang, query_item: q },
        confidence: 'high',
      }
    }
  }

  // QUERY_LOCATION: "what's in X" / "qué hay en X"
  const queryLocEn = lower.match(/(?:what'?s?|what is)\s+in\s+(?:the\s+)?(.+?)\??$/i)
  const queryLocEs = lower.match(/(?:qué|que)\s+hay\s+en\s+(?:el|la|los|las)?\s*(.+?)\??$/i)
  const queryLocMatch = queryLocEn || queryLocEs
  if (queryLocMatch) {
    const loc = queryLocMatch[1].trim()
    if (loc && loc.length > 0) {
      return {
        intent: { intent: 'QUERY_LOCATION', language: lang, query_location: loc },
        confidence: 'high',
      }
    }
  }

  // STORE: "put X in Y" / "dejé X en Y" / "X están en Y"
  const storeMatchEn = lower.match(/(?:put|placed|stored|left)\s+(?:the\s+)?(.+?)\s+(?:in|on|under|by|at)\s+(?:the\s+)?(.+)/i)
  const storeMatchEs = lower.match(/(?:dejé|guardé|puse|metí|coloqué)\s+(?:el|la|los|las|mi|mis)?\s*(.+?)\s+(?:en|sobre|bajo|debajo\s+de)\s+(?:el|la|los|las)?\s*(.+)/i)
  const storeMatchEs2 = lower.match(/(.+?)\s+(?:están|está)\s+(?:en|sobre)\s+(?:el|la|los|las)?\s*(.+)/i)
  const storeMatch = storeMatchEn || storeMatchEs || storeMatchEs2
  if (storeMatch) {
    const item = (storeMatch[1] ?? '').trim()
    const locStr = (storeMatch[2] ?? '').trim().replace(/\s+/g, ' ')
    if (item && locStr) {
      const path: LocationPathSegment[] = [{ type: 'place', label: locStr }]
      return {
        intent: { intent: 'STORE', language: lang, item_name: item, location_path: path },
        confidence: 'high',
      }
    }
  }

  // DESCRIBE_PLACE: "there's a X" / "hay una X" / "X has/tiene Y"
  const describeEn = lower.match(/(?:there'?s?|there is)\s+(?:a\s+)?(.+?)\s+(?:in|on|behind)\s+(?:the\s+)?(.+)/i)
  const describeEs = lower.match(/(?:en\s+)?(.+?)\s+(?:hay|tiene)\s+(?:una?|un|el|la)?\s*(.+)/i)
  const describeMatch = describeEn || describeEs
  if (describeMatch) {
    const part1 = (describeMatch[1] ?? '').trim()
    const part2 = (describeMatch[2] ?? '').trim()
    if (part1 && part2) {
      const path: LocationPathSegment[] = [
        { type: 'place', label: part1 },
        { type: 'furniture', label: part2 },
      ]
      return {
        intent: { intent: 'DESCRIBE_PLACE', language: lang, location_path: path, location_paths: [path] },
        confidence: 'medium',
      }
    }
  }

  // No match
  return {
    intent: { intent: 'OTHER', language: lang },
    confidence: 'low',
  }
}

/** Call Gemini for intent when regex fails or returns OTHER. Requires geminiKey. */
export async function classifyIntentLLM(
  message: string,
  placesSummary: string,
  geminiKey: string
): Promise<LLMIntent> {
  const systemPrompt = `You are a helpful butler that helps users organize where they store things at home.
You MUST respond with a JSON object only (no markdown, no extra text).

**LABELS RULE (most important)**: For "label" in location_path, you MUST use the user's EXACT words as written. Copy verbatim from their message. NEVER translate ("Despacho de Judit" is NOT "Oficina"). NEVER synonymize ("cajonera" is NOT "Cómoda"). NEVER paraphrase ("segundo cajón" is NOT "Cajón del Medio" — "segundo" means second, "del medio" means middle). WRONG: Oficina, Cómoda, Cajón del Medio. CORRECT: despacho de Judit, cajonera, segundo cajón.

**Language detection**: Detect whether the user is writing in English or Spanish. Set "language" to "en" or "es".

**Intent classification**:
- STORE: User is telling you where they put something (e.g. "I put the keys in the drawer").
- QUERY: User is asking where a specific item is (e.g. "where are my keys?").
- QUERY_LOCATION: User is asking what is in a place (e.g. "what's in the table behind the sofa?").
- DESCRIBE_PLACE: User is describing a place or hierarchy without storing an item (e.g. "There's a beige box on the small table behind the sofa", "El despacho de Judit tiene un escritorio con tres cajones").
- OTHER: Small talk, unclear.

**Existing places** (use to match or disambiguate; return matched_place_id when the user clearly refers to one):
${placesSummary || '(none yet)'}

**For STORE**: Extract "item_name" (the item) and "location_path": array of { type, label }. Types are free-form: room, desk, drawer, box, shelf, table, etc.

Labels must be exact substrings from the user's message. If they say "cajonera" write "cajonera", not "Cómoda". If they say "despacho de Judit" write "despacho de Judit", not "Oficina". If they say "segundo cajón" write "segundo cajón", not "Cajón del Medio".

If the description matches an existing place above, set "matched_place_id" to that place's id.
Example: "I put the passport in the second drawer of Judit's desk" -> {"intent":"STORE","language":"en","item_name":"passport","location_path":[{"type":"desk","label":"Judit's desk"},{"type":"drawer","label":"second drawer"}]}
Example (es): "En el segundo cajón de la cajonera del despacho de Judit están los Gomets" -> {"intent":"STORE","language":"es","item_name":"Gomets","location_path":[{"type":"room","label":"despacho de Judit"},{"type":"furniture","label":"cajonera"},{"type":"drawer","label":"segundo cajón"}]}

**For QUERY**: Extract "query_item".
**For QUERY_LOCATION**: Extract "query_location" (the place description).
**For DESCRIBE_PLACE**: Extract "location_path" or "location_paths" (array of paths) for the place(s) and hierarchy being described. Use the user's EXACT words for "label" (no translation or synonymizing).
Example: "The living room has a small table behind the sofa. On the table there's a beige box" -> {"intent":"DESCRIBE_PLACE","language":"en","location_paths":[[{"type":"room","label":"living room"},{"type":"furniture","label":"small table behind the sofa"},{"type":"box","label":"beige box"}]]}
Example (es): "En el Despacho de Judit hay una cajonera" -> {"intent":"DESCRIBE_PLACE","language":"es","location_paths":[[{"type":"room","label":"Despacho de Judit"},{"type":"furniture","label":"cajonera"}]]}

Always respond with valid JSON only.`

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: message }] }],
          generationConfig: { temperature: 0.05 },
        }),
      }
    )
    if (!res.ok) {
      const errBody = await res.text()
      console.error('Gemini API error:', res.status, errBody)
      return { intent: 'OTHER', language: detectLanguage(message) }
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { intent: 'OTHER', language: detectLanguage(message) }
    const parsed = JSON.parse(jsonMatch[0])
    let locPath = Array.isArray(parsed.location_path) ? parsed.location_path : undefined
    let locPaths = Array.isArray(parsed.location_paths) ? parsed.location_paths : undefined
    if (locPath?.length) locPath = fixLabelsFromMessage(locPath, message)
    if (locPaths?.length) {
      locPaths = locPaths.map((p: LocationPathSegment[]) =>
        Array.isArray(p) && p.length ? fixLabelsFromMessage(p, message) : p
      )
    }
    return {
      intent: parsed.intent ?? 'OTHER',
      language: parsed.language === 'es' ? 'es' : 'en',
      item_name: parsed.item_name,
      category: parsed.category,
      query_item: parsed.query_item,
      query_location: parsed.query_location,
      location_path: locPath,
      location_paths: locPaths,
      matched_place_id: parsed.matched_place_id,
    }
  } catch {
    return { intent: 'OTHER', language: detectLanguage(message) }
  }
}

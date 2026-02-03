import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildCanonicalKey, buildLocationDescFromPath } from './picklists.ts'

type SupabaseClientType = ReturnType<typeof createClient>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeItem(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

const CONCEPT_SIMILARITY_THRESHOLD = 0.78
const CONCEPT_QUERY_THRESHOLD = 0.65

function canonicalizeConceptLabel(input: string | undefined | null): string {
  if (!input) return ''
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function embeddingToVectorLiteral(values: number[]): string {
  const trimmed = values.map((value) => {
    if (!Number.isFinite(value)) return 0
    return Number(value.toFixed(6))
  })
  return `[${trimmed.join(',')}]`
}

async function embedTextForConcept(text: string, geminiKey?: string): Promise<number[] | null> {
  if (!geminiKey) return null
  const clean = text.trim()
  if (!clean) return null
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: clean.slice(0, 600) }] },
        }),
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      embedding?: { values?: number[] }
      data?: Array<{ embedding?: { values?: number[] } }>
    }
    const vector = json.embedding?.values ?? json.data?.[0]?.embedding?.values
    if (Array.isArray(vector) && vector.length > 0) {
      return vector.map((v) => (typeof v === 'number' ? v : Number(v)))
    }
  } catch {
    // ignore and fall back
  }
  return null
}

interface ConceptSuggestion {
  concept: string
  aliases: string[]
  broader: string[]
}

async function requestConceptSuggestion(itemName: string, geminiKey?: string): Promise<ConceptSuggestion | null> {
  if (!geminiKey) return null
  const prompt = `You classify household items into reusable semantic concepts.
Return strict JSON: {"concept":"base noun phrase","aliases":["synonym1","synonym2"],"broader":["category","subcategory"]}.
- "concept" should be short (1-4 words), singular, and capture the essence of the item.
- Include at least one alias removing adjectives (e.g. "gafas").
- "broader" should list more generic groupings (e.g. "materiales para pintar warhammer").
Input: "${itemName}".`
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Partial<ConceptSuggestion>
    return {
      concept: parsed.concept?.trim() ?? itemName,
      aliases: Array.isArray(parsed.aliases) ? parsed.aliases.filter((a): a is string => typeof a === 'string') : [],
      broader: Array.isArray(parsed.broader) ? parsed.broader.filter((a): a is string => typeof a === 'string') : [],
    }
  } catch {
    return null
  }
}

async function findConceptByAliases(
  supabase: SupabaseClientType,
  householdId: string,
  aliases: string[]
): Promise<{ conceptId: string; label?: string } | null> {
  const canonical = aliases
    .map((alias) => canonicalizeConceptLabel(alias))
    .filter((alias) => alias.length > 0)
  if (canonical.length === 0) return null
  try {
    const { data } = await supabase
      .from('item_concept_aliases')
      .select('concept_id, concept:item_concepts(label)')
      .eq('household_id', householdId)
      .in('canonical_alias', canonical)
      .limit(1)
    if (data && data.length > 0) {
      return { conceptId: data[0].concept_id as string, label: (data[0] as { concept?: { label?: string } }).concept?.label }
    }
  } catch {
    // ignore
  }
  return null
}

async function upsertConceptAliases(
  supabase: SupabaseClientType,
  householdId: string,
  conceptId: string,
  aliases: string[]
) {
  const payload = aliases
    .map((alias) => ({
      alias: alias.trim(),
      canonical_alias: canonicalizeConceptLabel(alias),
    }))
    .filter((row) => row.alias.length > 0 && row.canonical_alias.length > 0)
    .map((row) => ({
      household_id: householdId,
      concept_id: conceptId,
      alias: row.alias,
      canonical_alias: row.canonical_alias,
    }))
  if (payload.length === 0) return
  await supabase
    .from('item_concept_aliases')
    .upsert(payload, { onConflict: 'household_id,canonical_alias', ignoreDuplicates: false })
}

interface ConceptResolution {
  conceptId: string
  label: string
}

async function ensureConceptForItem(
  supabase: SupabaseClientType,
  householdId: string,
  itemName: string,
  geminiKey?: string
): Promise<ConceptResolution | null> {
  if (!geminiKey) return null
  const suggestion = await requestConceptSuggestion(itemName, geminiKey)
  const primary = suggestion?.concept?.trim() || itemName
  const aliasSet = new Set<string>([itemName, primary])
  suggestion?.aliases?.forEach((alias) => alias && aliasSet.add(alias))
  const aliasList = Array.from(aliasSet).filter((alias) => alias.trim().length > 0)

  // Try alias match first
  const aliasMatch = await findConceptByAliases(supabase, householdId, aliasList)
  if (aliasMatch) {
    await upsertConceptAliases(supabase, householdId, aliasMatch.conceptId, aliasList)
    return { conceptId: aliasMatch.conceptId, label: aliasMatch.label ?? primary }
  }

  let vectorLiteral: string | null = null
  const embedding = await embedTextForConcept(primary, geminiKey)
  if (embedding) {
    vectorLiteral = embeddingToVectorLiteral(embedding)
    try {
      const { data } = await supabase.rpc('match_item_concepts', {
        p_household_id: householdId,
        query_embedding: vectorLiteral,
        match_threshold: CONCEPT_SIMILARITY_THRESHOLD,
        match_count: 3,
      })
      if (data && data.length > 0) {
        const match = data[0] as { concept_id: string; label?: string }
        await upsertConceptAliases(supabase, householdId, match.concept_id, aliasList)
        return { conceptId: match.concept_id, label: match.label ?? primary }
      }
    } catch {
      // ignore similarity errors
    }
  }

  let parentConceptId: string | null = null
  if (suggestion?.broader?.length) {
    const parentMatch = await findConceptByAliases(supabase, householdId, suggestion.broader)
    parentConceptId = parentMatch?.conceptId ?? null
  }

  const insertPayload: Record<string, unknown> = {
    household_id: householdId,
    label: primary,
    canonical_label: canonicalizeConceptLabel(primary),
    parent_concept_id: parentConceptId,
  }
  if (vectorLiteral) {
    insertPayload.embedding = vectorLiteral
  } else if (embedding) {
    insertPayload.embedding = embeddingToVectorLiteral(embedding)
  }

  const { data: created } = await supabase
    .from('item_concepts')
    .insert(insertPayload)
    .select('id, label')
    .single()

  if (!created) return null

  await upsertConceptAliases(supabase, householdId, created.id as string, aliasList)

  return { conceptId: created.id as string, label: (created as { label?: string }).label ?? primary }
}

interface ConceptMatchResult {
  conceptIds: string[]
  matchedLabel?: string
}

async function resolveConceptIdsForQuery(
  supabase: SupabaseClientType,
  householdId: string,
  queryText: string,
  geminiKey?: string
): Promise<ConceptMatchResult | null> {
  const aliasMatch = await findConceptByAliases(supabase, householdId, [queryText])
  if (aliasMatch) {
    return { conceptIds: [aliasMatch.conceptId], matchedLabel: aliasMatch.label ?? queryText }
  }

  if (!geminiKey) return null

  const embedding = await embedTextForConcept(queryText, geminiKey)
  if (!embedding) return null
  const vectorLiteral = embeddingToVectorLiteral(embedding)
  try {
    const { data } = await supabase.rpc('match_item_concepts', {
      p_household_id: householdId,
      query_embedding: vectorLiteral,
      match_threshold: CONCEPT_QUERY_THRESHOLD,
      match_count: 5,
    })
    if (data && data.length > 0) {
      const ids = (data as Array<{ concept_id: string }>).map((row) => row.concept_id)
      const firstLabel = (data[0] as { label?: string }).label
      return { conceptIds: ids, matchedLabel: firstLabel }
    }
  } catch {
    return null
  }
  return null
}

async function linkEntryToConcept(
  supabase: SupabaseClientType,
  householdId: string,
  entryId: string,
  conceptId: string
) {
  await supabase.from('storage_entry_concepts').delete().eq('entry_id', entryId).eq('household_id', householdId)
  await supabase.from('storage_entry_concepts').upsert(
    [
      {
        entry_id: entryId,
        concept_id: conceptId,
        household_id: householdId,
        source: 'llm',
        confidence: 0.9,
      },
    ],
    { onConflict: 'entry_id,concept_id', ignoreDuplicates: false }
  )
}

async function backfillMissingConcepts(
  supabase: SupabaseClientType,
  householdId: string,
  geminiKey?: string,
  batchSize = 3
) {
  if (!geminiKey) return
  try {
    const { data: entries } = await supabase
      .from('storage_entries')
      .select('id, item_name, storage_entry_concepts!left(concept_id)')
      .eq('household_id', householdId)
      .is('storage_entry_concepts.concept_id', null)
      .order('updated_at', { ascending: false })
      .limit(batchSize)

    if (!entries || entries.length === 0) return

    for (const entry of entries as Array<{ id: string; item_name: string }>) {
      const concept = await ensureConceptForItem(supabase, householdId, entry.item_name, geminiKey)
      if (concept) {
        await linkEntryToConcept(supabase, householdId, entry.id, concept.conceptId)
      }
    }
  } catch {
    // Backfill is opportunistic; ignore failures
  }
}

/** Extract location phrases from Spanish/English text (e.g. "segundo cajón", "cajonera", "despacho de Judit") to override LLM labels */
function extractLocationPhrasesFromMessage(message: string): string[] {
  const parts: string[] = []
  const re = /(?:en el |en la |del |de la |de el |in the |in a )(.+?)(?=\s+de la |\s+del |\s+están|\s+está|\s+is |\s+are |,|$)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(message)) !== null) {
    const phrase = m[1].trim()
    if (phrase && phrase.length > 1) parts.push(phrase)
  }
  return parts
}

/** Replace LLM labels with exact phrases from user message when we can match them (root-to-leaf order) */
function fixLabelsFromMessage(path: LocationPathSegment[], message: string): LocationPathSegment[] {
  const phrases = extractLocationPhrasesFromMessage(message)
  if (phrases.length !== path.length) return path
  const rootToLeaf = phrases.reverse()
  return path.map((seg, i) => ({
    ...seg,
    label: rootToLeaf[i] ?? seg.label,
  }))
}

function buildPlacesSummary(places: Array<{ id: string; label: string; canonical_key: string | null; parent_place_id: string | null }>): string {
  const byParent = new Map<string | null, typeof places>()
  for (const p of places) {
    const parent = p.parent_place_id
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent)!.push(p)
  }
  const lines: string[] = []
  function walk(parentId: string | null, prefix: string) {
    const children = byParent.get(parentId) ?? []
    for (const p of children) {
      const path = prefix ? `${prefix} › ${p.label}` : p.label
      lines.push(`- [${p.id}] ${path}`)
      walk(p.id, path)
    }
  }
  walk(null, '')
  return lines.join('\n')
}

async function findMatchingPlaceBySemantics(
  description: string,
  placesSummary: string,
  geminiKey: string
): Promise<string | null> {
  const prompt = `Given this location description and existing places, does the description refer to one of these places?
If yes, return the place id in JSON: {"matched_place_id": "uuid"}.
If no match or unclear, return: {"matched_place_id": null}.

Description: "${description}"

Existing places:
${placesSummary}

Return JSON only.`
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  )
  if (!res.ok) return null
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0])
    return parsed.matched_place_id ?? null
  } catch {
    return null
  }
}

async function normalizeLocationViaLLM(
  description: string,
  geminiKey: string
): Promise<NormalizedLocation | null> {
  const prompt = `Parse this location description into a structured hierarchy. Return JSON only.
Use the user's EXACT words for "label" - do not translate or substitute (e.g. "Despacho de Judit" stays "Despacho de Judit", "cajonera" stays "cajonera").
Format: { "location_path": [ { "type": "room|furniture|shelf|drawer|box|folder|table|etc", "label": "user's exact words", "attributes": { "color": "x", "position": "y", "size": "z" } } ], "canonical_key": "type:label:..." }
Examples:
- "the table behind the sofa" -> {"location_path":[{"type":"room","label":"living room"},{"type":"furniture","label":"table","attributes":{"position":"behind sofa"}}],"canonical_key":"room:living_room:furniture:table_position:behind_sofa"}
- "la cajonera del despacho de Judit" -> {"location_path":[{"type":"room","label":"despacho de Judit"},{"type":"furniture","label":"cajonera"}],"canonical_key":"room:despacho_de_judit:furniture:cajonera"}
Input: "${description}"`
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  )
  if (!res.ok) return null
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0])
    const path = Array.isArray(parsed.location_path) ? parsed.location_path : []
    const canonical = parsed.canonical_key ?? buildCanonicalKey(path)
    return { location_path: path, canonical_key: canonical }
  } catch {
    return null
  }
}

async function resolveOrCreatePlace(
  supabase: ReturnType<typeof createClient>,
  householdId: string,
  locationPath: LocationPathSegment[],
  confirm: boolean,
  matchedPlaceId: string | null,
  placesSummary: string,
  geminiKey: string | undefined
): Promise<
  | { place_id: string; location_description: string; confidence: 'high' }
  | { place_id: null; location_description: string; confidence: 'high' }
  | { suggestedPlaceId: string; suggestedPlaceLabel: string; locationPath: LocationPathSegment[]; confidence: 'low' | 'medium' }
> {
  if (locationPath.length === 0) {
    return { place_id: null, location_description: '', confidence: 'high' }
  }
  const locationDescription = buildLocationDescFromPath(locationPath)
  const fullCanonicalKey = buildCanonicalKey(locationPath)

  const { data: allPlaces } = await supabase.from('places').select('id, canonical_key, label, attributes, parent_place_id').eq('household_id', householdId)
  const placesList = (allPlaces ?? []) as Array<{ id: string; canonical_key: string | null; label: string; attributes?: Record<string, string>; parent_place_id: string | null }>

  if (matchedPlaceId) {
    const found = placesList.find((p) => p.id === matchedPlaceId)
    if (found) {
      const lastSeg = locationPath[locationPath.length - 1]
      const newAttrs = lastSeg?.attributes ?? {}
      const existingAttrs = found.attributes ?? {}
      if (Object.keys(newAttrs).length > 0) {
        const merged = { ...existingAttrs, ...newAttrs }
        await supabase.from('places').update({ attributes: merged }).eq('id', found.id).eq('household_id', householdId)
      }
      return { place_id: found.id, location_description: locationDescription, confidence: 'high' }
    }
  }

  const exactMatch = placesList.find((p) => p.canonical_key === fullCanonicalKey)
  if (exactMatch) {
    const lastSeg = locationPath[locationPath.length - 1]
    const newAttrs = lastSeg?.attributes ?? {}
    const existingAttrs = exactMatch.attributes ?? {}
    if (Object.keys(newAttrs).length > 0) {
      const merged = { ...existingAttrs, ...newAttrs }
      await supabase.from('places').update({ attributes: merged }).eq('id', exactMatch.id).eq('household_id', householdId)
    }
    return { place_id: exactMatch.id, location_description: locationDescription, confidence: 'high' }
  }

  const partialMatches = placesList.filter(
    (p) =>
      p.canonical_key && (fullCanonicalKey.includes(p.canonical_key) || p.canonical_key.includes(fullCanonicalKey))
  )
  if (partialMatches.length === 1 && !confirm) {
    return {
      suggestedPlaceId: partialMatches[0].id,
      suggestedPlaceLabel: partialMatches[0].label,
      locationPath,
      confidence: 'medium',
    }
  }
  if (partialMatches.length > 1 && !confirm) {
    return {
      suggestedPlaceId: partialMatches[0].id,
      suggestedPlaceLabel: partialMatches[0].label,
      locationPath,
      confidence: 'low',
    }
  }

  if (!confirm && placesList.length > 0 && geminiKey) {
    const semanticMatch = await findMatchingPlaceBySemantics(locationDescription, placesSummary, geminiKey)
    if (semanticMatch) {
      const found = placesList.find((p) => p.id === semanticMatch)
      if (found) {
        return {
          suggestedPlaceId: found.id,
          suggestedPlaceLabel: found.label,
          locationPath,
          confidence: 'medium',
        }
      }
    }
  }

  let parentId: string | null = null
  for (let i = 0; i < locationPath.length; i++) {
    const segment = locationPath[i]
    const pathSoFar = locationPath.slice(0, i + 1)
    const canonicalKey = buildCanonicalKey(pathSoFar)
    const existing = placesList.find((p) => p.canonical_key === canonicalKey)
    if (existing) {
      parentId = existing.id
      continue
    }
    const row = {
      household_id: householdId,
      type: segment.type ?? 'place',
      label: segment.label ?? 'unknown',
      parent_place_id: parentId,
      attributes: segment.attributes ?? {},
      canonical_key: canonicalKey,
    }
    const { data: created, error: insertError } = await supabase
      .from('places')
      .upsert(row, { onConflict: 'household_id,canonical_key', ignoreDuplicates: false })
      .select('id')
      .single()
    if (created) {
      placesList.push({
        id: created.id,
        canonical_key: canonicalKey,
        label: segment.label,
        attributes: segment.attributes,
        parent_place_id: parentId,
      })
      parentId = created.id
    } else if (insertError?.code === '23505') {
      const { data: existingRow } = await supabase
        .from('places')
        .select('id')
        .eq('household_id', householdId)
        .eq('canonical_key', canonicalKey)
        .single()
      if (existingRow) {
        placesList.push({
          id: existingRow.id,
          canonical_key: canonicalKey,
          label: segment.label,
          attributes: segment.attributes,
          parent_place_id: parentId,
        })
        parentId = existingRow.id
      } else {
        break
      }
    } else {
      break
    }
  }
  if (parentId) {
    return { place_id: parentId, location_description: locationDescription, confidence: 'high' }
  }
  return { place_id: null, location_description: locationDescription, confidence: 'high' }
}

type Lang = 'en' | 'es'


interface QueryResult {
  item_name: string
  room_key: string | null
  spot_key: string | null
  spot_detail: string | null
  location_description: string
  place_id?: string | null
}

interface PendingUpdate {
  entryId: string
  oldLocation: string
  newLocation: string
  item_name: string
  room_key: string
  spot_key?: string
  spot_detail?: string
  category_key?: string
}

interface LocationPathSegment {
  type: string
  label: string
  attributes?: Record<string, string>
}

interface NormalizedLocation {
  location_path: LocationPathSegment[]
  canonical_key: string
}

interface LLMIntent {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { message, householdId, confirm, confirmPlaceId } = (await req.json()) as { message?: string; householdId?: string; confirm?: boolean; confirmPlaceId?: string }
    if (!message || typeof message !== 'string' || !householdId || typeof householdId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing message or householdId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const geminiKey = Deno.env.get('GEMINI_API_KEY')

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError) {
      return new Response(
        JSON.stringify({ error: userError.message ?? 'Invalid JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: member } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('household_id', householdId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this household' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let intentResult: LLMIntent = { intent: 'OTHER', language: 'en' }

    const { data: placesData } = await supabase
      .from('places')
      .select('id, label, canonical_key, parent_place_id')
      .eq('household_id', householdId)
    const placesListForSummary = (placesData ?? []) as Array<{ id: string; label: string; canonical_key: string | null; parent_place_id: string | null }>
    const placesSummary = buildPlacesSummary(placesListForSummary)

    if (geminiKey) {
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

**For STORE**: Extract "item_name" (the item) and "location_path": array of { type, label, attributes? }. Types are free-form: room, desk, drawer, box, shelf, table, etc.

Labels must be exact substrings from the user's message. If they say "cajonera" write "cajonera", not "Cómoda". If they say "despacho de Judit" write "despacho de Judit", not "Oficina". If they say "segundo cajón" write "segundo cajón", not "Cajón del Medio".

If the description matches an existing place above, set "matched_place_id" to that place's id.
Example: "I put the passport in the second drawer of Judit's desk" -> {"intent":"STORE","language":"en","item_name":"passport","location_path":[{"type":"desk","label":"Judit's desk"},{"type":"drawer","label":"second drawer"}]}
Example (es): "En el segundo cajón de la cajonera del despacho de Judit están los Gomets" -> {"intent":"STORE","language":"es","item_name":"Gomets","location_path":[{"type":"room","label":"despacho de Judit"},{"type":"furniture","label":"cajonera"},{"type":"drawer","label":"segundo cajón"}]}

**For QUERY**: Extract "query_item".
**For QUERY_LOCATION**: Extract "query_location" (the place description).
**For DESCRIBE_PLACE**: Extract "location_path" or "location_paths" (array of paths) for the place(s) and hierarchy being described. Use the user's EXACT words for "label" (no translation or synonymizing).
Example: "The living room has a small table behind the sofa. On the table there's a beige box" -> {"intent":"DESCRIBE_PLACE","language":"en","location_paths":[[{"type":"room","label":"living room"},{"type":"furniture","label":"table","attributes":{"position":"behind sofa","size":"small"}},{"type":"box","label":"box","attributes":{"color":"beige"}}]]}
Example (es): "En el Despacho de Judit hay una cajonera" -> {"intent":"DESCRIBE_PLACE","language":"es","location_paths":[[{"type":"room","label":"Despacho de Judit"},{"type":"furniture","label":"cajonera"}]]}

Always respond with valid JSON only.`

      const geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: message }] }],
            generationConfig: { temperature: 0.05 },
          }),
        }
      )

      if (!geminiRes.ok) {
        const errBody = await geminiRes.text()
        console.error('Gemini API error:', geminiRes.status, errBody)
      } else {
        const geminiJson = (await geminiRes.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const text =
          geminiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0])
            let locPath = Array.isArray(parsed.location_path) ? parsed.location_path : undefined
            let locPaths = Array.isArray(parsed.location_paths) ? parsed.location_paths : undefined
            if (locPath?.length) {
              locPath = fixLabelsFromMessage(locPath, message)
            }
            if (locPaths?.length) {
              locPaths = locPaths.map((p: LocationPathSegment[]) =>
                Array.isArray(p) && p.length ? fixLabelsFromMessage(p, message) : p
              )
            }
            intentResult = {
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
            intentResult = { intent: 'OTHER', language: 'en' }
          }
        }
      }
    } else {
      const lower = message.toLowerCase()
      const isSpanish = /(?:dejé|guardé|puse|dónde|está|están|por favor|tengo|las?|los?|el\s|en\s(?:el|la|los|las))/.test(lower)
      const lang: Lang = isSpanish ? 'es' : 'en'

      const storeMatchEn = lower.match(/(?:put|placed|stored|left)\s+(?:the\s+)?(.+?)\s+(?:in|on|under|by|at)\s+(?:the\s+)?(.+)/)
      const storeMatchEs = lower.match(/(?:dejé|guardé|puse|metí|coloqué)\s+(?:el|la|los|las|mi|mis)?\s*(.+?)\s+(?:en|sobre|bajo|debajo\s+de)\s+(?:el|la|los|las)?\s*(.+)/)
      const storeMatch = storeMatchEn || storeMatchEs

      if (storeMatch) {
        const locStr = storeMatch[2].trim()
        const path: LocationPathSegment[] = [{ type: 'place', label: locStr.replace(/\s+/g, ' ') }]
        intentResult = {
          intent: 'STORE',
          language: lang,
          item_name: storeMatch[1].trim(),
          location_path: path,
        }
      } else {
        const queryMatchEn = lower.match(/\bwhere\s+(?:is|are)\s+(?:the\s+|my\s+)?(.+?)\??$/)
        const queryMatchEs = lower.match(/(?:dónde|donde)\s+(?:está|están|dejé|guardé|puse)\s+(?:el|la|los|las|mi|mis)?\s*(.+?)\??$/)
        const queryMatch = queryMatchEn || queryMatchEs
        if (queryMatch) {
          const q = queryMatch[1].trim()
          if (q) intentResult = { intent: 'QUERY', language: lang, query_item: q }
        } else {
          const queryLocEn = lower.match(/(?:what'?s?|what is)\s+in\s+(?:the\s+)?(.+?)\??$/)
          const queryLocEs = lower.match(/(?:qué|que)\s+hay\s+en\s+(?:el|la|los|las)?\s*(.+?)\??$/)
          const queryLocMatch = queryLocEn || queryLocEs
          if (queryLocMatch) {
            const loc = queryLocMatch[1].trim()
            if (loc) intentResult = { intent: 'QUERY_LOCATION', language: lang, query_location: loc }
          } else {
            intentResult = { intent: 'OTHER', language: lang }
          }
        }
      }
    }

    const lang = intentResult.language
    let reply: string
    let locationRef: { room_key?: string; spot_key?: string; place_id?: string; place_label?: string } | undefined
    let queryResults: QueryResult[] | undefined
    let pendingUpdate: PendingUpdate | undefined
    let pendingPlaceMatch: { suggestedPlaceId: string; suggestedPlaceLabel: string; locationPath: LocationPathSegment[]; confidence: 'low' | 'medium' } | undefined

    if (intentResult.intent === 'QUERY_LOCATION' && intentResult.query_location) {
      const locDesc = intentResult.query_location.trim()
      let normalized: NormalizedLocation | null = null
      if (geminiKey) {
        normalized = await normalizeLocationViaLLM(locDesc, geminiKey)
      }
      if (!normalized) {
        const simpleKey = locDesc.toLowerCase().replace(/\s+/g, '_').replace(/^(the|el|la|los|las)\_?/, '')
        normalized = {
          location_path: [{ type: 'furniture', label: simpleKey }],
          canonical_key: `furniture:${simpleKey}`,
        }
      }
      if (normalized) {
        const { data: places } = await supabase
          .from('places')
          .select('id, canonical_key, label, type, parent_place_id')
          .eq('household_id', householdId)
        const allPlaces = (places ?? []) as Array<{ id: string; canonical_key: string | null; label: string; type: string; parent_place_id: string | null }>
        const matching = allPlaces.filter(
          (p) =>
            p.canonical_key && (p.canonical_key === normalized.canonical_key || normalized.canonical_key.includes(p.canonical_key) || p.canonical_key.includes(normalized.canonical_key))
        )
        const placeIds = new Set<string>()
        function addDescendants(pid: string) {
          placeIds.add(pid)
          for (const p of allPlaces) {
            if (p.parent_place_id === pid) addDescendants(p.id)
          }
        }
        for (const p of matching) addDescendants(p.id)
        if (placeIds.size > 0) {
          const { data: rows } = await supabase
            .from('storage_entries')
            .select('id, item_name, location_description, room_key, spot_key, spot_detail, place_id')
            .eq('household_id', householdId)
            .in('place_id', [...placeIds])
          if (rows && rows.length > 0) {
            queryResults = rows.map((r: { item_name: string; room_key: string | null; spot_key: string | null; spot_detail: string | null; location_description: string; place_id: string | null }) => ({
              item_name: r.item_name,
              room_key: r.room_key,
              spot_key: r.spot_key,
              spot_detail: r.spot_detail,
              location_description: r.location_description,
              place_id: r.place_id,
            }))
            const locLabel = matching[0] ? (matching[0] as { label: string }).label : locDesc
            reply = lang === 'es'
              ? `En ${locLabel}: ${rows.map((r: { item_name: string }) => r.item_name).join(', ')}`
              : `In ${locLabel}: ${rows.map((r: { item_name: string }) => r.item_name).join(', ')}`
            locationRef = { place_id: matching[0].id, place_label: matching[0].label }
          } else {
            reply = lang === 'es'
              ? `No tengo nada registrado en ese lugar.`
              : "I don't have anything stored there."
          }
        } else {
          const { data: rows } = await supabase
            .from('storage_entries')
            .select('id, item_name, location_description, room_key, spot_key, spot_detail, place_id')
            .eq('household_id', householdId)
            .ilike('location_description', `%${locDesc.split(/\s+/)[0]}%`)
          if (rows && rows.length > 0) {
            queryResults = rows.map((r: { item_name: string; room_key: string | null; spot_key: string | null; spot_detail: string | null; location_description: string; place_id: string | null }) => ({
              item_name: r.item_name,
              room_key: r.room_key,
              spot_key: r.spot_key,
              spot_detail: r.spot_detail,
              location_description: r.location_description,
              place_id: r.place_id,
            }))
            reply = lang === 'es'
              ? `Encontré: ${rows.map((r: { item_name: string }) => r.item_name).join(', ')}`
              : `Found: ${rows.map((r: { item_name: string }) => r.item_name).join(', ')}`
          } else {
            reply = lang === 'es'
              ? 'No tengo nada registrado en ese lugar.'
              : "I don't have anything stored there."
          }
        }
      } else {
        reply = lang === 'es'
          ? 'No pude entender ese lugar. ¿Puedes describirlo de otra forma?'
          : "I couldn't understand that location. Can you describe it differently?"
      }
      return new Response(JSON.stringify({ reply, language: lang, locationRef, queryResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (intentResult.intent === 'DESCRIBE_PLACE' && (intentResult.location_path?.length || (intentResult.location_paths?.length ?? 0) > 0)) {
      const paths = intentResult.location_paths ?? (intentResult.location_path ? [intentResult.location_path] : [])
      const createdLabels: string[] = []
      for (const path of paths) {
        if (path.length === 0) continue
        const placeResult = await resolveOrCreatePlace(supabase, householdId, path, true, intentResult.matched_place_id ?? null, placesSummary, geminiKey)
        if ('place_id' in placeResult && placeResult.place_id) {
          createdLabels.push(placeResult.location_description)
        }
      }
      if (createdLabels.length > 0) {
        reply = lang === 'es'
          ? `Entendido, he anotado: ${createdLabels.join('; ')}`
          : `Got it, I've noted: ${createdLabels.join('; ')}`
      } else {
        reply = lang === 'es'
          ? 'No pude interpretar ese lugar. ¿Puedes describirlo de otra forma?'
          : "I couldn't understand that place. Can you describe it differently?"
      }
      return new Response(JSON.stringify({ reply, language: lang }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (intentResult.intent === 'STORE' && intentResult.item_name && intentResult.location_path && intentResult.location_path.length > 0) {
      const originalItemName = intentResult.item_name.trim()
      const itemName = normalizeItem(intentResult.item_name)
      const locationPath = intentResult.location_path
      let placeResult: Awaited<ReturnType<typeof resolveOrCreatePlace>>
      if (confirmPlaceId) {
        const { data: place } = await supabase.from('places').select('id, label').eq('id', confirmPlaceId).eq('household_id', householdId).single()
        if (place) {
          placeResult = { place_id: place.id, location_description: place.label, confidence: 'high' as const }
        } else {
          placeResult = await resolveOrCreatePlace(supabase, householdId, locationPath, true, null, placesSummary, geminiKey)
        }
      } else {
        placeResult = await resolveOrCreatePlace(supabase, householdId, locationPath, !!confirm, intentResult.matched_place_id ?? null, placesSummary, geminiKey)
      }
      if ('suggestedPlaceId' in placeResult) {
        reply = lang === 'es'
          ? `¿Te refieres al lugar "${placeResult.suggestedPlaceLabel}"? Confirma para guardar ahí.`
          : `Do you mean the place "${placeResult.suggestedPlaceLabel}"? Confirm to save there.`
        pendingPlaceMatch = {
          suggestedPlaceId: placeResult.suggestedPlaceId,
          suggestedPlaceLabel: placeResult.suggestedPlaceLabel,
          locationPath: placeResult.locationPath,
          confidence: placeResult.confidence,
        }
        return new Response(JSON.stringify({ reply, language: lang, pendingPlaceMatch }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const locationDesc = 'place_id' in placeResult ? placeResult.location_description : buildLocationDescFromPath(locationPath)

      const writeData: Record<string, unknown> = {
        location_description: locationDesc,
        room_key: null,
        spot_key: null,
        spot_detail: null,
        category_key: intentResult.category ?? null,
        updated_at: new Date().toISOString(),
        created_by: user.id,
      }
      if ('place_id' in placeResult && placeResult.place_id) {
        writeData.place_id = placeResult.place_id
      }

      const { data: existing } = await supabase
        .from('storage_entries')
        .select('id, location_description')
        .eq('household_id', householdId)
        .ilike('item_name', itemName)
        .limit(1)
        .maybeSingle()
      if (existing && !confirm) {
        const oldLocation = existing.location_description ?? ''
        if (oldLocation !== locationDesc) {
          reply = lang === 'es'
            ? `${intentResult.item_name} está actualmente en ${oldLocation}. ¿Mover a ${locationDesc}?`
            : `${intentResult.item_name} is currently in ${oldLocation}. Move to ${locationDesc}?`

          pendingUpdate = {
            entryId: existing.id,
            oldLocation,
            newLocation: locationDesc,
            item_name: intentResult.item_name,
            room_key: locationDesc,
          }

          return new Response(JSON.stringify({ reply, language: lang, pendingUpdate }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      let conceptResolution: ConceptResolution | null = null
      if (geminiKey) {
        conceptResolution = await ensureConceptForItem(supabase, householdId, originalItemName, geminiKey)
      }

      let entryIdForConcept: string | null = existing?.id ?? null

      // Proceed with the write
      let dbError = false
      if (existing) {
        // Snapshot current location into location_history before updating
        try {
          await supabase.from('location_history').insert({
            entry_id: existing.id,
            household_id: householdId,
            room_key: null,
            spot_key: null,
            spot_detail: null,
            location_description: existing.location_description,
            moved_by: user.id,
          })
        } catch {
          // Non-critical: don't fail the store if history insert fails
        }

        const { error: updateErr } = await supabase
          .from('storage_entries')
          .update(writeData)
          .eq('id', existing.id)
        if (updateErr) dbError = true
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('storage_entries')
          .insert({
            household_id: householdId,
            item_name: itemName,
            ...writeData,
          })
          .select('id')
          .single()
        if (insertErr) {
          dbError = true
        } else if (inserted) {
          entryIdForConcept = inserted.id as string
        }
      }

      if (dbError) {
        reply = lang === 'es'
          ? 'No pude guardar eso. Por favor, inténtelo de nuevo.'
          : "I couldn't save that. Please try again."
      } else {
        reply = lang === 'es'
          ? `Entendido, recordaré que ${intentResult.item_name} está en ${locationDesc}.`
          : `Got it, I'll remember that ${intentResult.item_name} is in ${locationDesc}.`

        if ('place_id' in placeResult && placeResult.place_id) {
          locationRef = { place_id: placeResult.place_id, place_label: locationDesc }
        }

        if (conceptResolution && entryIdForConcept) {
          try {
            await linkEntryToConcept(supabase, householdId, entryIdForConcept, conceptResolution.conceptId)
          } catch {
            // Non-critical failure; continue without blocking reply
          }
        }
      }
    } else if (intentResult.intent === 'QUERY' && intentResult.query_item) {
      const search = normalizeItem(intentResult.query_item)
      await backfillMissingConcepts(supabase, householdId, geminiKey)
      const conceptContext = await resolveConceptIdsForQuery(supabase, householdId, intentResult.query_item, geminiKey)
      let rows: Array<{ id: string; item_name: string; location_description: string; place_id?: string | null }> = []

      if (conceptContext?.conceptIds?.length) {
        const { data: entryLinks } = await supabase
          .from('storage_entry_concepts')
          .select('entry_id')
          .eq('household_id', householdId)
          .in('concept_id', conceptContext.conceptIds)

        const mappedIds = (entryLinks ?? [])
          .map((link: { entry_id: string | null }) => link.entry_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
        const entryIds = Array.from(new Set(mappedIds))

        if (entryIds.length > 0) {
          const limitedEntryIds = entryIds.slice(0, 20)
          const { data: conceptRows } = await supabase
            .from('storage_entries')
            .select('id, item_name, location_description, place_id')
            .eq('household_id', householdId)
            .in('id', limitedEntryIds)
            .order('updated_at', { ascending: false })
            .limit(20)

          if (conceptRows && conceptRows.length > 0) {
            rows = conceptRows as typeof rows
          }
        }
      }

      if (rows.length === 0) {
        const { data: fallbackRows } = await supabase
          .from('storage_entries')
          .select('id, item_name, location_description, place_id')
          .eq('household_id', householdId)
          .ilike('item_name', `%${search}%`)
          .order('updated_at', { ascending: false })
          .limit(5)
        rows = fallbackRows ?? []
      }

      if (rows.length > 0) {
        queryResults = rows.map((row) => ({
          item_name: row.item_name,
          room_key: null,
          spot_key: null,
          spot_detail: null,
          location_description: row.location_description,
          place_id: row.place_id,
        }))

        if (rows.length === 1) {
          const row = rows[0]
          const loc = row.location_description

          let previousNote = ''
          try {
            const { data: history } = await supabase
              .from('location_history')
              .select('location_description')
              .eq('entry_id', row.id)
              .order('moved_at', { ascending: false })
              .limit(1)

            if (history && history.length > 0) {
              const prevLocation = history[0].location_description
              previousNote = lang === 'es'
                ? ` (Anteriormente: ${prevLocation})`
                : ` (Previously: ${prevLocation})`
            }
          } catch {
            // Non-critical
          }

          const prefix = conceptContext?.matchedLabel
            ? (lang === 'es' ? `Dentro de ${conceptContext.matchedLabel}: ` : `Within ${conceptContext.matchedLabel}: `)
            : ''

          reply = lang === 'es'
            ? `${prefix}${row.item_name} está en ${loc}.${previousNote}`
            : `${prefix}${row.item_name} is in ${loc}.${previousNote}`

          locationRef = row.place_id ? { place_id: row.place_id, place_label: loc } : undefined
        } else {
          const lines = rows.map((row) => {
            const loc = row.location_description
            return `- **${row.item_name}** → ${loc}`
          })

          const baseLabel = lang === 'es' ? `Encontré ${rows.length} coincidencias` : `I found ${rows.length} matches`
          const contextLabel = conceptContext?.matchedLabel
            ? lang === 'es'
              ? `${baseLabel} para "${conceptContext.matchedLabel}":`
              : `${baseLabel} for "${conceptContext.matchedLabel}":`
            : `${baseLabel}:`

          reply = `${contextLabel}\n${lines.join('\n')}`

          const first = rows[0]
          locationRef = first.place_id ? { place_id: first.place_id, place_label: first.location_description } : undefined
        }
      } else {
        reply = conceptContext?.matchedLabel
          ? lang === 'es'
            ? `No tengo nada guardado bajo ${conceptContext.matchedLabel}.`
            : `I don't have anything stored under ${conceptContext.matchedLabel}.`
          : lang === 'es'
            ? 'No tengo registrado un lugar para eso.'
            : "I don't have a stored place for that."
      }
    } else {
      reply = lang === 'es'
        ? 'Puedo recordar dónde guardas las cosas o decirte dónde está algo. Prueba: "Las llaves están en el cajón" o "¿Dónde están las llaves?"'
        : 'I can remember where you put things or tell you where something is. Try: "Keys are in the drawer" or "Where are the keys?"'
    }

    return new Response(JSON.stringify({ reply, language: lang, locationRef, queryResults, pendingUpdate, pendingPlaceMatch }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', reply: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Concept resolution: alias match, embedding match, create. Minimal Gemini usage.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { canonicalizeConceptLabel, embeddingToVectorLiteral } from './utils.ts'

export type SupabaseClientType = ReturnType<typeof createClient>

const CONCEPT_SIMILARITY_THRESHOLD = 0.78
const CONCEPT_QUERY_THRESHOLD = 0.65

/** Call Gemini text-embedding-004 API to get vector for semantic similarity. Used for concept matching. */
export async function embedTextForConcept(text: string, geminiKey?: string): Promise<number[] | null> {
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

/** Ask Gemini to classify an item into a concept with aliases and broader categories. Only used when creating new concept. */
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

/** Look up an existing concept by canonical alias. Used before creating new concepts or matching queries. */
export async function findConceptByAliases(
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

/** Insert or update aliases for a concept. Keeps item_concept_aliases in sync when linking items. */
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

export interface ConceptResolution {
  conceptId: string
  label: string
}

const SKIP_CONCEPT_SUGGESTION_FOR_SIMPLE_NAMES = true

/**
 * Get or create a concept for an item. Resolution order:
 * 1. Alias match (DB only)  2. Embedding match (1 embedding API)  3. Create (optionally requestConceptSuggestion)
 */
export async function ensureConceptForItem(
  supabase: SupabaseClientType,
  householdId: string,
  itemName: string,
  geminiKey?: string
): Promise<ConceptResolution | null> {
  const trimmed = itemName.trim()
  if (!trimmed) return null

  const aliasVariants = [trimmed]
  const withoutArticles = trimmed.replace(/^(the|las?|los?|el|la|un|una)\s+/i, '').trim()
  if (withoutArticles && withoutArticles !== trimmed) aliasVariants.push(withoutArticles)

  const aliasMatch = await findConceptByAliases(supabase, householdId, aliasVariants)
  if (aliasMatch) {
    await upsertConceptAliases(supabase, householdId, aliasMatch.conceptId, [trimmed])
    return { conceptId: aliasMatch.conceptId, label: aliasMatch.label ?? trimmed }
  }

  let vectorLiteral: string | null = null
  const embedding = geminiKey ? await embedTextForConcept(trimmed, geminiKey) : null
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
        await upsertConceptAliases(supabase, householdId, match.concept_id, [trimmed])
        return { conceptId: match.concept_id, label: match.label ?? trimmed }
      }
    } catch {
      // ignore
    }
  }

  const isSimpleName = SKIP_CONCEPT_SUGGESTION_FOR_SIMPLE_NAMES && trimmed.split(/\s+/).length <= 2
  let primary = trimmed
  let aliasList = [trimmed]
  let parentConceptId: string | null = null

  if (!isSimpleName && geminiKey) {
    const suggestion = await requestConceptSuggestion(trimmed, geminiKey)
    if (suggestion) {
      primary = suggestion.concept?.trim() || trimmed
      const aliasSet = new Set<string>([trimmed, primary])
      suggestion.aliases?.forEach((a) => a && aliasSet.add(a))
      aliasList = Array.from(aliasSet).filter((a) => a.trim().length > 0)
      if (suggestion.broader?.length) {
        const parentMatch = await findConceptByAliases(supabase, householdId, suggestion.broader)
        parentConceptId = parentMatch?.conceptId ?? null
      }
    }
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
  } else if (geminiKey) {
    const fallbackEmbed = await embedTextForConcept(primary, geminiKey)
    if (fallbackEmbed) insertPayload.embedding = embeddingToVectorLiteral(fallbackEmbed)
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

export interface ConceptMatchResult {
  conceptIds: string[]
  matchedLabel?: string
}

/** Resolve a search query to concept IDs via alias or embedding similarity. */
export async function resolveConceptIdsForQuery(
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

/** Replace concept links for a storage entry. */
export async function linkEntryToConcept(
  supabase: SupabaseClientType,
  householdId: string,
  entryId: string,
  conceptId: string
) {
  await supabase.from('storage_entry_concepts').delete().eq('entry_id', entryId).eq('household_id', householdId)
  await supabase
    .from('storage_entry_concepts')
    .upsert(
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

export const BACKFILL_ENABLED = false

/** Background: ensure concepts for entries that lack them. Deferred by default; run via cron or separate endpoint. */
export async function backfillMissingConcepts(
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

/**
 * Place resolution: build summary, normalize location, resolve or create place hierarchy.
 * Semantic match only when ambiguous (multiple partial matches).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildCanonicalKey, buildLocationDescFromPath } from './picklists.ts'
import type { LocationPathSegment, NormalizedLocation } from './picklists.ts'

export type SupabaseClientType = ReturnType<typeof createClient>

/** Build a tree-formatted text summary of places for LLM context. */
export function buildPlacesSummary(
  places: Array<{ id: string; label: string; canonical_key: string | null; parent_place_id: string | null }>
): string {
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

/** Ask Gemini if a location description refers to an existing place. Only when ambiguous (multiple partial matches). */
export async function findMatchingPlaceBySemantics(
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

/** Parse a free-form location description into structured hierarchy via Gemini. Used when heuristic fails. */
export async function normalizeLocationViaLLM(
  description: string,
  geminiKey: string
): Promise<NormalizedLocation | null> {
  const prompt = `Parse this location description into a structured hierarchy. Return JSON only.
Use the user's EXACT words for "label" - do not translate or substitute (e.g. "Despacho de Judit" stays "Despacho de Judit", "cajonera" stays "cajonera").
Format: { "location_path": [ { "type": "room|furniture|shelf|drawer|box|folder|table|etc", "label": "user's exact words" } ], "canonical_key": "type:label:..." }
Examples:
- "the table behind the sofa" -> {"location_path":[{"type":"room","label":"living room"},{"type":"furniture","label":"table behind the sofa"}],"canonical_key":"room:living_room:furniture:table_behind_the_sofa"}
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

/**
 * Resolve a location path to an existing place or create the hierarchy.
 * Semantic match only when partialMatches > 1 (ambiguous).
 */
export async function resolveOrCreatePlace(
  supabase: SupabaseClientType,
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

  const { data: allPlaces } = await supabase
    .from('places')
    .select('id, canonical_key, label, parent_place_id')
    .eq('household_id', householdId)
  const placesList = (allPlaces ?? []) as Array<{
    id: string
    canonical_key: string | null
    label: string
    parent_place_id: string | null
  }>

  if (matchedPlaceId) {
    const found = placesList.find((p) => p.id === matchedPlaceId)
    if (found) {
      return { place_id: found.id, location_description: locationDescription, confidence: 'high' }
    }
  }

  const exactMatch = placesList.find((p) => p.canonical_key === fullCanonicalKey)
  if (exactMatch) {
    return { place_id: exactMatch.id, location_description: locationDescription, confidence: 'high' }
  }

  const partialMatches = placesList.filter(
    (p) =>
      p.canonical_key &&
      (fullCanonicalKey.includes(p.canonical_key) || p.canonical_key.includes(fullCanonicalKey))
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
    if (geminiKey && placesList.length > 0) {
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
    return {
      suggestedPlaceId: partialMatches[0].id,
      suggestedPlaceLabel: partialMatches[0].label,
      locationPath,
      confidence: 'low',
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
    // Determine sort_order for the new place (max among siblings + 1)
    let sortOrder = 1
    if (parentId === null) {
      const { data: maxRows } = await supabase
        .from('places')
        .select('sort_order')
        .eq('household_id', householdId)
        .is('parent_place_id', null)
        .order('sort_order', { ascending: false })
        .limit(1)
      sortOrder = ((maxRows as Array<{ sort_order: number }> | null)?.[0]?.sort_order ?? 0) + 1
    } else {
      const { data: maxRows } = await supabase
        .from('places')
        .select('sort_order')
        .eq('household_id', householdId)
        .eq('parent_place_id', parentId)
        .order('sort_order', { ascending: false })
        .limit(1)
      sortOrder = ((maxRows as Array<{ sort_order: number }> | null)?.[0]?.sort_order ?? 0) + 1
    }
    const row = {
      household_id: householdId,
      type: segment.type ?? 'place',
      label: segment.label ?? 'unknown',
      parent_place_id: parentId,
      canonical_key: canonicalKey,
      sort_order: sortOrder,
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

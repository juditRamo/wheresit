/**
 * Chat Edge Function — Household Inventory Assistant
 *
 * This Supabase Edge Function powers a conversational "where's it?" system. Users chat
 * in natural language (Spanish or English) to:
 *   - STORE: Record where they put something ("Keys are in the drawer")
 *   - QUERY: Ask where an item is ("Where are my keys?")
 *   - QUERY_LOCATION: Ask what's in a place ("What's in the table behind the sofa?")
 *   - DESCRIBE_PLACE: Describe a place hierarchy ("Judit's office has a desk with three drawers")
 *
 * Flow overview:
 *   1. Request arrives → auth + household membership validated
 *   2. Intent classified via Gemini LLM (or regex fallback if no API key)
 *   3. Routing: STORE → resolve/create place → upsert storage_entry (+ concept linking)
 *             QUERY → resolve concept IDs → find entries by concept or name
 *             QUERY_LOCATION → normalize location → find matching places → list entries
 *             DESCRIBE_PLACE → resolve/create place hierarchy (no item stored)
 *   4. Response returned with reply text, locationRef, queryResults, or pending confirmations
 *
 * Concepts: Items are linked to semantic "concepts" (e.g. "gafas" → "gafas") via embeddings
 * and aliases, enabling fuzzy search ("glasses" finds "gafas").
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLocationDescFromPath, normalizeLocationHeuristic, type NormalizedLocation } from './picklists.ts'
import { classifyIntentRegex, classifyIntentLLM, type LLMIntent, type LocationPathSegment } from './intent.ts'
import { normalizeItem } from './utils.ts'
import {
  ensureConceptForItem,
  linkEntryToConcept,
  resolveConceptIdsForQuery,
  backfillMissingConcepts,
  BACKFILL_ENABLED,
  type ConceptResolution,
} from './concepts.ts'
import { buildPlacesSummary, normalizeLocationViaLLM, resolveOrCreatePlace } from './places.ts'

/**
 * Tuning constants (reduce Gemini usage when true):
 * - USE_LLM_FOR_INTENT_WHEN_REGEX_FAILS: call LLM for intent only when regex returns OTHER or low confidence
 * - concepts.BACKFILL_ENABLED: run backfill on empty QUERY (off by default; use cron instead)
 * - concepts.SKIP_CONCEPT_SUGGESTION_FOR_SIMPLE_NAMES: skip requestConceptSuggestion for ≤2-word items
 */
const USE_LLM_FOR_INTENT_WHEN_REGEX_FAILS = true

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Concept/place/utils logic moved to concepts.ts, places.ts, utils.ts
type Lang = 'en' | 'es'

/** Single item result returned to client for display in search/location query UI. */
interface QueryResult {
  item_name: string
  location_description: string
  place_id?: string | null
}

/** Pending move confirmation: client must confirm before updating entry location. */
interface PendingUpdate {
  entryId: string
  oldLocation: string
  newLocation: string
  item_name: string
  category_key?: string
}

/**
 * Main HTTP handler. Flow:
 * 1. CORS preflight
 * 2. Auth: validate JWT, load user, verify household membership
 * 3. Intent: call Gemini (or regex fallback) to classify STORE/QUERY/QUERY_LOCATION/DESCRIBE_PLACE/OTHER
 * 4. Route by intent → build reply, queryResults, pendingUpdate, pendingPlaceMatch
 * 5. Return JSON response
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- Auth ---
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

    // --- Intent classification: regex-first, LLM only when needed ---
    const { data: placesData } = await supabase
      .from('places')
      .select('id, label, canonical_key, parent_place_id')
      .eq('household_id', householdId)
    const placesListForSummary = (placesData ?? []) as Array<{ id: string; label: string; canonical_key: string | null; parent_place_id: string | null }>
    const placesSummary = buildPlacesSummary(placesListForSummary)

    const regexResult = classifyIntentRegex(message)
    const useLLM =
      USE_LLM_FOR_INTENT_WHEN_REGEX_FAILS &&
      geminiKey &&
      (regexResult.confidence === 'low' || regexResult.intent.intent === 'OTHER')

    let intentResult: LLMIntent = regexResult.intent
    if (useLLM) {
      intentResult = await classifyIntentLLM(message, placesSummary, geminiKey)
    }

    // --- Route by intent ---
    const lang = intentResult.language
    let reply: string
    let locationRef: { place_id?: string; place_label?: string; location_description?: string } | undefined
    let queryResults: QueryResult[] | undefined
    let pendingUpdate: PendingUpdate | undefined
    let pendingPlaceMatch: { suggestedPlaceId: string; suggestedPlaceLabel: string; locationPath: LocationPathSegment[]; confidence: 'low' | 'medium' } | undefined

    // QUERY_LOCATION: "What's in X?" → heuristic first, then LLM only when needed
    if (intentResult.intent === 'QUERY_LOCATION' && intentResult.query_location) {
      const locDesc = intentResult.query_location.trim()
      let normalized: NormalizedLocation | null = normalizeLocationHeuristic(locDesc)
      if (!normalized && geminiKey) {
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
            .select('id, item_name, location_description, place_id')
            .eq('household_id', householdId)
            .in('place_id', [...placeIds])
          if (rows && rows.length > 0) {
            queryResults = rows.map((r: { item_name: string; location_description: string; place_id: string | null }) => ({
              item_name: r.item_name,
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
            .select('id, item_name, location_description, place_id')
            .eq('household_id', householdId)
            .ilike('location_description', `%${locDesc.split(/\s+/)[0]}%`)
          if (rows && rows.length > 0) {
            queryResults = rows.map((r: { item_name: string; location_description: string; place_id: string | null }) => ({
              item_name: r.item_name,
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

    // DESCRIBE_PLACE: "There's a desk with drawers" → create place hierarchy, no item stored
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

    // STORE: "X is in Y" → resolve/create place, upsert storage_entry, link concept
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
        category_key: intentResult.category ?? null,
        updated_at: new Date().toISOString(),
        created_by: user.id,
      }
      if ('place_id' in placeResult && placeResult.place_id) {
        writeData.place_id = placeResult.place_id
      }

      const { data: existing } = await supabase
        .from('storage_entries')
        .select('id, location_description, place_id')
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
        try {
          await supabase.from('history_events').insert({
            household_id: householdId,
            actor_id: user.id,
            event_type: 'move_object',
            entity_type: 'storage_entry',
            entity_id: existing.id,
            payload: {
              item_name: itemName,
              from: {
                location_description: existing.location_description,
                place_id: existing.place_id ?? undefined,
              },
              to: {
                location_description: writeData.location_description,
                place_id: writeData.place_id ?? undefined,
              },
            },
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
          try {
            await supabase.from('history_events').insert({
              household_id: householdId,
              actor_id: user.id,
              event_type: 'add_object',
              entity_type: 'storage_entry',
              entity_id: inserted.id,
              payload: {
                item_name: itemName,
                location_description: writeData.location_description,
                place_id: writeData.place_id ?? undefined,
              },
            })
          } catch {
            // Non-critical
          }
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
    }
    // QUERY: "Where is X?" → direct ilike first, then concept resolution (alias → embedding)
    else if (intentResult.intent === 'QUERY' && intentResult.query_item) {
      const search = normalizeItem(intentResult.query_item)
      let rows: Array<{ id: string; item_name: string; location_description: string; place_id?: string | null }> = []
      let conceptContext: { conceptIds: string[]; matchedLabel?: string } | null = null

      // 1. Direct name match (DB only, no LLM)
      const { data: directRows } = await supabase
        .from('storage_entries')
        .select('id, item_name, location_description, place_id')
        .eq('household_id', householdId)
        .ilike('item_name', `%${search}%`)
        .order('updated_at', { ascending: false })
        .limit(5)
      if (directRows && directRows.length > 0) {
        rows = directRows as typeof rows
      }

      // 2. Concept resolution (alias → embedding) only when direct match failed
      if (rows.length === 0) {
        conceptContext = await resolveConceptIdsForQuery(supabase, householdId, intentResult.query_item, geminiKey)
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
            const { data: conceptRows } = await supabase
              .from('storage_entries')
              .select('id, item_name, location_description, place_id')
              .eq('household_id', householdId)
              .in('id', entryIds.slice(0, 20))
              .order('updated_at', { ascending: false })
              .limit(20)
            if (conceptRows && conceptRows.length > 0) rows = conceptRows as typeof rows
          }
        }
      }

      // 3. Backfill only when enabled and still empty (deferred by default)
      if (rows.length === 0 && BACKFILL_ENABLED && geminiKey) {
        await backfillMissingConcepts(supabase, householdId, geminiKey, 1)
        conceptContext = await resolveConceptIdsForQuery(supabase, householdId, intentResult.query_item, geminiKey)
        if (conceptContext?.conceptIds?.length) {
          const { data: entryLinks } = await supabase
            .from('storage_entry_concepts')
            .select('entry_id')
            .eq('household_id', householdId)
            .in('concept_id', conceptContext.conceptIds)
          const mappedIds = (entryLinks ?? []).map((l: { entry_id: string | null }) => l.entry_id).filter((id): id is string => !!id)
          const entryIds = Array.from(new Set(mappedIds))
          if (entryIds.length > 0) {
            const { data: conceptRows } = await supabase
              .from('storage_entries')
              .select('id, item_name, location_description, place_id')
              .eq('household_id', householdId)
              .in('id', entryIds.slice(0, 20))
              .order('updated_at', { ascending: false })
              .limit(20)
            if (conceptRows?.length) rows = conceptRows as typeof rows
          }
        }
      }

      if (rows.length > 0) {
        queryResults = rows.map((row) => ({
          item_name: row.item_name,
          location_description: row.location_description,
          place_id: row.place_id,
        }))

        if (rows.length === 1) {
          const row = rows[0]
          const loc = row.location_description

          let previousNote = ''
          try {
            const { data: history } = await supabase
              .from('history_events')
              .select('payload')
              .eq('entity_type', 'storage_entry')
              .eq('entity_id', row.id)
              .eq('event_type', 'move_object')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (history?.payload && typeof history.payload === 'object' && history.payload !== null && 'from' in history.payload) {
              const from = (history.payload as { from?: { location_description?: string } }).from
              const prevLocation = from?.location_description
              if (prevLocation) {
                previousNote = lang === 'es'
                  ? ` (Anteriormente: ${prevLocation})`
                  : ` (Previously: ${prevLocation})`
              }
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

          locationRef = row.place_id ? { place_id: row.place_id, place_label: loc } : { location_description: loc, place_label: loc }
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
          locationRef = first.place_id ? { place_id: first.place_id, place_label: first.location_description } : { location_description: first.location_description, place_label: first.location_description }
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
    }
    // OTHER: fallback hint when intent unclear
    else {
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

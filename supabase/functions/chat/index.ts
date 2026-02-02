import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  ROOM_KEYS, SPOT_KEYS, SPOT_DETAIL_KEYS, CATEGORY_KEYS,
  buildLocationString, roomLabel, spotLabel,
  isCustomRoom, isCustomSpot, isCustomDetail,
} from './picklists.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeItem(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

type Lang = 'en' | 'es'

interface NewTag {
  type: 'room' | 'spot' | 'detail'
  key: string
  label: string
}

interface QueryResult {
  item_name: string
  room_key: string | null
  spot_key: string | null
  spot_detail: string | null
  location_description: string
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

interface LLMIntent {
  intent: 'STORE' | 'QUERY' | 'OTHER'
  language: Lang
  item_name?: string
  room_key?: string
  spot_key?: string
  spot_detail?: string
  category_key?: string
  query_item?: string
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

    const { message, householdId, confirm } = (await req.json()) as { message?: string; householdId?: string; confirm?: boolean }
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

    if (geminiKey) {
      const systemPrompt = `You are a helpful butler that helps users remember where they store things at home.
You MUST respond with a JSON object only (no markdown, no extra text).

**Language detection**: Detect whether the user is writing in English or Spanish.
Set "language" to "en" or "es" accordingly.

**Intent classification**: Classify the message into one of:
- STORE: User is telling you where they put something.
- QUERY: User is asking where something is.
- OTHER: Small talk, unclear, or not about storing/finding things.

**For STORE intents**, extract structured picklist keys:
- "item_name": the item being stored (use the user's words)
- "room_key": pick from [${ROOM_KEYS.join(', ')}] or use the user's custom text if none match
- "spot_key": pick from [${SPOT_KEYS.join(', ')}] or use custom text. Optional.
- "spot_detail": pick from [${SPOT_DETAIL_KEYS.join(', ')}] or use custom text. Optional.
- "category_key": infer from context, pick from [${CATEGORY_KEYS.join(', ')}]. Optional.

**For QUERY intents**, extract:
- "query_item": the item the user is asking about

Examples:
User (en): "I put the passport in the bedroom dresser top drawer"
-> {"intent":"STORE","language":"en","item_name":"passport","room_key":"bedroom","spot_key":"dresser","spot_detail":"top_drawer","category_key":"travel"}

User (es): "Dejé las llaves en la cocina, sobre la encimera"
-> {"intent":"STORE","language":"es","item_name":"llaves","room_key":"kitchen","spot_key":"counter","spot_detail":"on_top"}

User (en): "Where are my keys?"
-> {"intent":"QUERY","language":"en","query_item":"keys"}

User (es): "¿Dónde está el pasaporte?"
-> {"intent":"QUERY","language":"es","query_item":"pasaporte"}

User: "Hello"
-> {"intent":"OTHER","language":"en"}

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
            generationConfig: { temperature: 0.2 },
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
            intentResult = {
              intent: parsed.intent ?? 'OTHER',
              language: parsed.language === 'es' ? 'es' : 'en',
              item_name: parsed.item_name,
              room_key: parsed.room_key,
              spot_key: parsed.spot_key,
              spot_detail: parsed.spot_detail,
              category_key: parsed.category_key,
              query_item: parsed.query_item,
            }
          } catch {
            intentResult = { intent: 'OTHER', language: 'en' }
          }
        }
      }
    } else {
      // Regex fallback — EN and ES patterns
      const lower = message.toLowerCase()

      // Detect language
      const isSpanish = /(?:dejé|guardé|puse|dónde|está|están|por favor|tengo|las?|los?|el\s|en\s(?:el|la|los|las))/.test(lower)
      const lang: Lang = isSpanish ? 'es' : 'en'

      // EN store patterns
      const storeMatchEn = lower.match(/(?:put|placed|stored|left)\s+(?:the\s+)?(.+?)\s+(?:in|on|under|by|at)\s+(?:the\s+)?(.+)/)
      // ES store patterns
      const storeMatchEs = lower.match(/(?:dejé|guardé|puse|metí|coloqué)\s+(?:el|la|los|las|mi|mis)?\s*(.+?)\s+(?:en|sobre|bajo|debajo\s+de)\s+(?:el|la|los|las)?\s*(.+)/)

      const storeMatch = storeMatchEn || storeMatchEs

      if (storeMatch) {
        intentResult = {
          intent: 'STORE',
          language: lang,
          item_name: storeMatch[1].trim(),
          room_key: storeMatch[2].trim(),
        }
      } else {
        // EN query patterns
        const queryMatchEn = lower.match(/\bwhere\s+(?:is|are)\s+(?:the\s+|my\s+)?(.+?)\??$/)
        // ES query patterns
        const queryMatchEs = lower.match(/(?:dónde|donde)\s+(?:está|están|dejé|guardé|puse)\s+(?:el|la|los|las|mi|mis)?\s*(.+?)\??$/)

        const queryMatch = queryMatchEn || queryMatchEs
        if (queryMatch) {
          const q = queryMatch[1].trim()
          if (q) intentResult = { intent: 'QUERY', language: lang, query_item: q }
        } else {
          intentResult = { intent: 'OTHER', language: lang }
        }
      }
    }

    const lang = intentResult.language
    let reply: string
    let locationRef: { room_key: string; spot_key?: string } | undefined
    let newTags: NewTag[] | undefined
    let queryResults: QueryResult[] | undefined
    let pendingUpdate: PendingUpdate | undefined

    if (intentResult.intent === 'STORE' && intentResult.item_name && intentResult.room_key) {
      const itemName = normalizeItem(intentResult.item_name)
      const locationDesc = buildLocationString(
        intentResult.room_key,
        intentResult.spot_key,
        intentResult.spot_detail,
        'en' // always store English for location_description column
      )

      const translatedLocation = buildLocationString(
        intentResult.room_key,
        intentResult.spot_key,
        intentResult.spot_detail,
        lang
      )

      const writeData = {
        location_description: locationDesc,
        room_key: intentResult.room_key,
        spot_key: intentResult.spot_key ?? null,
        spot_detail: intentResult.spot_detail ?? null,
        category_key: intentResult.category_key ?? null,
        updated_at: new Date().toISOString(),
        created_by: user.id,
      }

      const { data: existing } = await supabase
        .from('storage_entries')
        .select('id, room_key, spot_key, spot_detail, location_description')
        .eq('household_id', householdId)
        .ilike('item_name', itemName)
        .limit(1)
        .maybeSingle()

      // Overwrite confirmation: if item exists with different location and confirm not set
      if (existing && !confirm) {
        const oldLocation = buildLocationString(
          existing.room_key,
          existing.spot_key,
          existing.spot_detail,
          lang
        ) || existing.location_description

        // Check if location actually changed
        const newLoc = translatedLocation
        if (oldLocation !== newLoc) {
          reply = lang === 'es'
            ? `${intentResult.item_name} está actualmente en ${oldLocation}. ¿Mover a ${newLoc}?`
            : `${intentResult.item_name} is currently in ${oldLocation}. Move to ${newLoc}?`

          pendingUpdate = {
            entryId: existing.id,
            oldLocation,
            newLocation: newLoc,
            item_name: intentResult.item_name,
            room_key: intentResult.room_key,
            spot_key: intentResult.spot_key,
            spot_detail: intentResult.spot_detail,
            category_key: intentResult.category_key,
          }

          return new Response(JSON.stringify({ reply, language: lang, pendingUpdate }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // Proceed with the write
      let dbError = false
      if (existing) {
        // Snapshot current location into location_history before updating
        try {
          await supabase.from('location_history').insert({
            entry_id: existing.id,
            household_id: householdId,
            room_key: existing.room_key,
            spot_key: existing.spot_key,
            spot_detail: existing.spot_detail,
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
        const { error: insertErr } = await supabase
          .from('storage_entries')
          .insert({
            household_id: householdId,
            item_name: itemName,
            ...writeData,
          })
        if (insertErr) dbError = true
      }

      if (dbError) {
        reply = lang === 'es'
          ? 'No pude guardar eso. Por favor, inténtelo de nuevo.'
          : "I couldn't save that. Please try again."
      } else {
        reply = lang === 'es'
          ? `Entendido, recordaré que ${intentResult.item_name} está en ${translatedLocation}.`
          : `Got it, I'll remember that ${intentResult.item_name} is in ${translatedLocation}.`

        locationRef = {
          room_key: intentResult.room_key,
          ...(intentResult.spot_key ? { spot_key: intentResult.spot_key } : {}),
        }

        // Detect custom (non-picklist) location values
        const candidates: NewTag[] = []
        if (isCustomRoom(intentResult.room_key)) {
          candidates.push({ type: 'room', key: intentResult.room_key, label: intentResult.room_key })
        }
        if (isCustomSpot(intentResult.spot_key)) {
          candidates.push({ type: 'spot', key: intentResult.spot_key!, label: intentResult.spot_key! })
        }
        if (isCustomDetail(intentResult.spot_detail)) {
          candidates.push({ type: 'detail', key: intentResult.spot_detail!, label: intentResult.spot_detail! })
        }

        if (candidates.length > 0) {
          // Filter out tags already saved for this household
          const { data: savedTags } = await supabase
            .from('household_tags')
            .select('tag_type, tag_key')
            .eq('household_id', householdId)

          const savedSet = new Set(
            (savedTags ?? []).map((t: { tag_type: string; tag_key: string }) => `${t.tag_type}:${t.tag_key}`)
          )
          const unsaved = candidates.filter((c) => !savedSet.has(`${c.type}:${c.key}`))
          if (unsaved.length > 0) {
            newTags = unsaved
          }
        }
      }
    } else if (intentResult.intent === 'QUERY' && intentResult.query_item) {
      const search = normalizeItem(intentResult.query_item)
      const { data: rows } = await supabase
        .from('storage_entries')
        .select('id, item_name, location_description, room_key, spot_key, spot_detail')
        .eq('household_id', householdId)
        .ilike('item_name', `%${search}%`)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (rows && rows.length > 0) {
        // Build query results array
        queryResults = rows.map((row: { item_name: string; room_key: string | null; spot_key: string | null; spot_detail: string | null; location_description: string }) => ({
          item_name: row.item_name,
          room_key: row.room_key,
          spot_key: row.spot_key,
          spot_detail: row.spot_detail,
          location_description: row.location_description,
        }))

        if (rows.length === 1) {
          const row = rows[0]
          const translatedLocation = row.room_key
            ? buildLocationString(row.room_key, row.spot_key, row.spot_detail, lang)
            : row.location_description

          // Fetch location history for "previously" note
          let previousNote = ''
          try {
            const { data: history } = await supabase
              .from('location_history')
              .select('room_key, spot_key, spot_detail, location_description')
              .eq('entry_id', row.id)
              .order('moved_at', { ascending: false })
              .limit(1)

            if (history && history.length > 0) {
              const prev = history[0]
              const prevLocation = prev.room_key
                ? buildLocationString(prev.room_key, prev.spot_key, prev.spot_detail, lang)
                : prev.location_description
              previousNote = lang === 'es'
                ? ` (Anteriormente: ${prevLocation})`
                : ` (Previously: ${prevLocation})`
            }
          } catch {
            // Non-critical
          }

          reply = lang === 'es'
            ? `${row.item_name} está en ${translatedLocation}.${previousNote}`
            : `${row.item_name} is in ${translatedLocation}.${previousNote}`

          locationRef = {
            room_key: row.room_key ?? row.location_description,
            ...(row.spot_key ? { spot_key: row.spot_key } : {}),
          }
        } else {
          // Multiple results
          const lines = rows.map((row: { item_name: string; room_key: string | null; spot_key: string | null; spot_detail: string | null; location_description: string }) => {
            const loc = row.room_key
              ? buildLocationString(row.room_key, row.spot_key, row.spot_detail, lang)
              : row.location_description
            return `- **${row.item_name}** → ${loc}`
          })

          const countLabel = lang === 'es' ? `Encontré ${rows.length} coincidencias:` : `I found ${rows.length} matches:`
          reply = `${countLabel}\n${lines.join('\n')}`

          // Use first result for locationRef
          const first = rows[0]
          locationRef = {
            room_key: first.room_key ?? first.location_description,
            ...(first.spot_key ? { spot_key: first.spot_key } : {}),
          }
        }
      } else {
        reply = lang === 'es'
          ? 'No tengo registrado un lugar para eso.'
          : "I don't have a stored place for that."
      }
    } else {
      reply = lang === 'es'
        ? 'Puedo recordar dónde guardas las cosas o decirte dónde está algo. Prueba: "Las llaves están en el cajón" o "¿Dónde están las llaves?"'
        : 'I can remember where you put things or tell you where something is. Try: "Keys are in the drawer" or "Where are the keys?"'
    }

    return new Response(JSON.stringify({ reply, language: lang, locationRef, newTags, queryResults, pendingUpdate }), {
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

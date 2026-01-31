import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeItem(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

interface LLMIntent {
  intent: 'STORE' | 'QUERY' | 'OTHER'
  item_name?: string
  location_description?: string
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

    const { message, householdId } = (await req.json()) as { message?: string; householdId?: string }
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

    let intentResult: LLMIntent = { intent: 'OTHER' }

    if (geminiKey) {
      const systemPrompt = `You are a helpful assistant that helps users remember where they store things at home.
Classify the user message into exactly one intent and respond with a JSON object only (no markdown, no extra text):
- STORE: User is telling you where they put something. Extract item_name and location_description. Example: "I put the keys in the drawer" -> {"intent":"STORE","item_name":"keys","location_description":"the drawer"}
- QUERY: User is asking where something is. Extract the item they're asking about as query_item. Example: "Where are the keys?" -> {"intent":"QUERY","query_item":"keys"}
- OTHER: Small talk, unclear, or not about storing/finding things. Respond with {"intent":"OTHER"}

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
            intentResult = JSON.parse(jsonMatch[0]) as LLMIntent
          } catch {
            intentResult = { intent: 'OTHER' }
          }
        }
      }
    } else {
      const lower = message.toLowerCase()
      const storeMatch = lower.match(/(?:put|placed|stored|left)\s+(?:the\s+)?(.+?)\s+(?:in|on|under|by)\s+(.+)/)
      if (storeMatch) {
        intentResult = {
          intent: 'STORE',
          item_name: storeMatch[1].trim(),
          location_description: storeMatch[2].trim(),
        }
      } else if (/\bwhere\s+(?:is|are)\s+(?:the\s+)?(.+?)\??$/.test(lower) || /^(.+?)\s+\?\s*$/.test(lower)) {
        const q = lower.replace(/\bwhere\s+(?:is|are)\s+(?:the\s+)?/i, '').replace(/\?+\s*$/, '').trim()
        if (q) intentResult = { intent: 'QUERY', query_item: q }
      }
    }

    let reply: string

    if (intentResult.intent === 'STORE' && intentResult.item_name && intentResult.location_description) {
      const itemName = normalizeItem(intentResult.item_name)
      const location = intentResult.location_description.trim()

      const { data: existing } = await supabase
        .from('storage_entries')
        .select('id')
        .eq('household_id', householdId)
        .ilike('item_name', itemName)
        .limit(1)
        .maybeSingle()

      if (existing) {
        const { error: updateErr } = await supabase
          .from('storage_entries')
          .update({
            location_description: location,
            updated_at: new Date().toISOString(),
            created_by: user.id,
          })
          .eq('id', existing.id)

        if (updateErr) reply = "I couldn't save that. Please try again."
        else reply = `Got it, I'll remember that ${intentResult.item_name} is in ${location}.`
      } else {
        const { error: insertErr } = await supabase.from('storage_entries').insert({
          household_id: householdId,
          item_name: itemName,
          location_description: location,
          created_by: user.id,
        })

        if (insertErr) reply = "I couldn't save that. Please try again."
        else reply = `Got it, I'll remember that ${intentResult.item_name} is in ${location}.`
      }
    } else if (intentResult.intent === 'QUERY' && intentResult.query_item) {
      const search = normalizeItem(intentResult.query_item)
      const { data: rows } = await supabase
        .from('storage_entries')
        .select('item_name, location_description')
        .eq('household_id', householdId)
        .ilike('item_name', `%${search}%`)
        .order('updated_at', { ascending: false })
        .limit(1)

      if (rows?.length) {
        reply = `${rows[0].item_name} is in ${rows[0].location_description}.`
      } else {
        reply = "I don't have a stored place for that."
      }
    } else {
      reply =
        "I can remember where you put things or tell you where something is. Try: “Keys are in the drawer” or “Where are the keys?”"
    }

    return new Response(JSON.stringify({ reply }), {
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

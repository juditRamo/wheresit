# WheresIt

A chat-style webapp to remember where you store things at home. Tell the app where you put something, then ask where it is when you need it. Data is shared per household.

- **Stack**: Vite + React + TypeScript, Supabase (Auth, Postgres, Edge Functions), Google Gemini (optional) for understanding messages.
- **Run**: `npm install` then `npm run dev`.

## Setup

1. **Environment**  
   Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL` – your Supabase project URL  
   - `VITE_SUPABASE_ANON_KEY` – your Supabase anon (public) key  

2. **Database**  
   Apply the schema and RLS in `supabase/migrations/`:
   - In the [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor, run the contents of `supabase/migrations/20250130000001_households_and_storage.sql`,  
   - or link the project with the [Supabase CLI](https://supabase.com/docs/guides/cli) and run:  
     `supabase db push`

3. **Edge Function (chat)**  
   - In Supabase Dashboard → Edge Functions → create/link project, then deploy the `chat` function from `supabase/functions/chat/`.  
   - In Dashboard → Project Settings → Edge Functions → Secrets, add:  
     `GEMINI_API_KEY` = your Google AI API key (optional; without it the app uses simple pattern matching).  
   - Get a key at [Google AI Studio](https://aistudio.google.com/app/apikey).

4. **Run the app**  
   `npm run dev` and open the URL shown (e.g. http://localhost:5173).

## Usage

- Sign up / sign in, then create or join a household.
- In the chat, say where you put something (e.g. “Keys are in the drawer”) or ask where something is (e.g. “Where are the keys?”).
- The app stores one “last place” per item per household and answers from that.

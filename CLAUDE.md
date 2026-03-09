# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is WheresIt

A bilingual (English/Spanish) chat-style webapp to remember where you store things at home. Users tell the app where they put something via natural language, then ask where it is later. Data is shared per household.

## Commands

- `npm run dev` — start Vite dev server (default http://localhost:5173)
- `npm run build` — type-check with `tsc -b` then build with Vite
- `npm run lint` — ESLint across the project
- `supabase db push` — apply migrations to the linked Supabase project
- Edge functions are deployed via Supabase CLI: `supabase functions deploy chat`

## Architecture

**Frontend:** Vite + React 19 + TypeScript. No component library — plain CSS per component (each `.tsx` has a matching `.css`). No router — tab-based SPA with `activeTab` state in `App.tsx`.

**Backend:** Supabase (Auth, Postgres with RLS, Edge Functions, Storage for photos). The client talks directly to Supabase via `@supabase/supabase-js` (`src/supabaseClient.ts`). All DB access is RLS-scoped to household membership via `public.user_household_ids()`.

**Edge Function (`supabase/functions/chat/`):** The chat endpoint is a Deno Edge Function. It classifies user intent (STORE/QUERY/QUERY_LOCATION/DESCRIBE_PLACE) using regex first, then Google Gemini LLM as fallback. Split across files: `index.ts` (main handler), `intent.ts` (classification), `places.ts` (place resolution/creation), `concepts.ts` (semantic item matching), `picklists.ts`, `utils.ts`.

### Key data model

- **households / household_members** — multi-tenant, RLS via `user_household_ids()`
- **storage_entries** — one row per item per household (item_name + location_description + place_id)
- **places** — nested location hierarchy (room > furniture > drawer) via `parent_place_id`, keyed by `canonical_key`
- **item_concepts / item_concept_aliases / storage_entry_concepts** — semantic concept layer with `pgvector` embeddings for fuzzy item search
- **history_events** — audit log of adds/moves/edits/deletes for both places and objects
- **profiles** — user display name, avatar, theme, language preferences

### Frontend structure

- `src/App.tsx` — main shell: auth gate > household gate > tab navigation (chat, items, locations, search)
- `src/hooks/` — data hooks (`useAuth`, `useHousehold`, `useStoredItems`, `usePlaces`, `useProfile`, `useActivityFeed`, `useStorageEntries`)
- `src/components/` — one component per view/feature, each with its own CSS file
- `src/i18n/` — `LanguageContext` (React context for en/es), `ui.ts` (UI string translations), `picklists.ts` (category/room/furniture labels)
- `src/theme/` — `ThemeContext` for light/dark/system mode
- `src/api/chat.ts` — client-side wrapper for calling the chat Edge Function
- `src/lib/historyEvents.ts` — helper for recording history events from the frontend

### Conventions

- i18n: all user-facing strings go through `ui.ts` keyed dictionary with `{en, es}` values, accessed via `useLanguage()` hook
- Types are centralized in `src/types.ts`
- Supabase migrations are ordered by date in `supabase/migrations/`
- Environment: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (see `.env.example`)

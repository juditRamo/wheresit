# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is WheresIt

A bilingual (English/Spanish) chat-style webapp to remember where you store things at home. Users tell the app where they put something via natural language, then ask where it is later. Data is shared per household.

## Commands

- `npm run dev` — start Vite dev server (default http://localhost:5173)
- `npm run build` — type-check with `tsc -b` then build with Vite
- `npm run lint` — ESLint across the project
- `npm run cap:sync` — build + sync to native platforms
- `npm run cap:ios` — build, sync, and open in Xcode
- `npm run cap:android` — build, sync, and open in Android Studio
- `supabase db push` — apply migrations to the linked Supabase project
- Edge functions are deployed via Supabase CLI: `supabase functions deploy chat`

## Architecture

**Frontend:** Vite + React 19 + TypeScript + Capacitor (iOS/Android). No component library — plain CSS per component (each `.tsx` has a matching `.css`). No router — tab-based SPA with `activeTab` state in `App.tsx`.

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

- `src/App.tsx` — main shell: auth gate > household gate > tab navigation (chat, items, locations, activity, settings)
- `src/components/` — all UI components, organized by role:
  - `views/` — one folder per tab/view, each with `ViewName.tsx`, `.css`, optional `helpers.ts`, and `components/` subfolder
    - `chat/` — ChatView, MessageList, MultiResultCard, ConfirmCards
    - `inventory/` — InventoryView, helpers (icon/grouping utilities)
    - `locations/` — LocationsView, SortablePlaceRow, LocationActionSheet
    - `activity/` — ActivityView, ActivityEventRow, helpers (date/time formatters)
    - `settings/` — SettingsView, SettingsProfileTab, SettingsHouseholdTab, CustomFieldsManager
  - `layout/` — app shell: BottomNav, Sidebar, Auth, LandingPage, HouseholdSelect
  - `sheets/` — BottomSheet (shared overlay+handle pattern), SheetHeader, SheetActions, edit-sheet.css (shared form styles), ItemEditSheet, PlaceEditSheet
  - `pickers/` — PlaceDrillDown, PlaceIconPicker
  - `fields/` — CustomFieldInputs, CustomFieldFilters, PhotoUpload
- `src/hooks/` — data hooks (`useAuth`, `useHousehold`, `useStoredItems`, `usePlaces`, `useProfile`, `useActivityFeed`, `useStorageEntries`)
- `src/i18n/` — `LanguageContext` (React context for en/es), `ui.ts` (UI string translations), `picklists.ts` (category/room/furniture labels)
- `src/theme/` — `ThemeContext` for light/dark/system mode
- `src/toast/` — toast notification system
- `src/api/chat.ts` — client-side wrapper for calling the chat Edge Function
- `src/lib/historyEvents.ts` — helper for recording history events from the frontend
- `src/lib/storage.ts` — async storage wrapper (Capacitor Preferences on native, localStorage on web)
- `capacitor.config.ts` — Capacitor configuration (app ID, plugins)
- `ios/` — native iOS project (Xcode)
- `android/` — native Android project (Android Studio)

### Conventions

- i18n: all user-facing strings go through `ui.ts` keyed dictionary with `{en, es}` values, accessed via `useLanguage()` hook
- Types are centralized in `src/types.ts`
- Supabase migrations are ordered by date in `supabase/migrations/`
- Environment: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (see `.env.example`)

### Component guidelines

- **Views** go in `src/components/views/<tab>/`. Each view has a main component, optional `helpers.ts` for pure functions, and `components/` for sub-components.
- **Shared components** (used by 2+ views) go in `src/components/<category>/`.
- **Layout components** (app shell, nav, auth gates) go in `src/components/layout/`.
- **Bottom sheets** should use the `<BottomSheet>` wrapper from `src/components/sheets/BottomSheet.tsx` for overlay, handle bar, and animations. Pass view-specific content as children.
- Each `.tsx` component has a matching `.css` file with BEM-style class names scoped to the component.
- Pure helper functions (formatters, grouping, icon lookups) should be extracted to `helpers.ts` files co-located with their view.

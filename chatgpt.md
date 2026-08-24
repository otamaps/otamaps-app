# OtaMaps App Notes for Codex

## Project Shape
- Expo / React Native app using Expo Router (`expo-router/entry`) and route groups under `app/`.
- Main tabs live in `app/(tabs)`, authenticated nested routes in `app/(app)`, and onboarding/login routes in `app/welcome`.
- TypeScript is strict and uses the `@/*` path alias for repository-root imports.
- Styling is mostly local `StyleSheet.create` blocks plus shared assets/constants. Custom Figtree fonts are loaded in `app/_layout.tsx`.

## Core Services
- `lib/supabase.ts` creates the Supabase client with AsyncStorage-backed auth persistence.
- `lib/roomService.ts` uses Zustand stores plus AsyncStorage caches for rooms and map features.
- `components/functions/bleScanner.tsx`, `lib/bleLocationService.ts`, `lib/bleBackgroundTask.ts`, and `lib/bleBackgroundManager.ts` implement BLE beacon scanning, location uploads, and background foreground-service behavior.
- `lib/friendsHandler.ts` handles friend lists, requests, blocking, and removal.
- FabLab/SumUp checkout UI lives under `app/(tabs)/fablab`; checkout creation is an authenticated backend responsibility.

## Commands
- Start dev server: `npm run start` or `yarn start`.
- Platform helpers: `npm run ios`, `npm run android`, `npm run web`.
- Lint: `npm run lint`.
- Type-check: `npx tsc --noEmit`.

## Current Gotchas
- `npx tsc --noEmit` currently reports pre-existing errors in debug Supabase screens, map layer typings, welcome route typing, and checkout error types.
- Friend relations use `"request"`, `"friends"`, and `"blocked"` statuses.
- `decoder.py` is present locally but ignored by Git.
- Large build artifacts (`*.apk`, `*.aab`, `*.ipa`) are ignored and should stay out of source changes.

## Editing Preferences
- Keep changes narrow and follow existing Expo Router / React Native patterns.
- Prefer `@/` imports for app-local modules.
- Avoid broad refactors unless needed for the requested behavior.
- Preserve user/local changes; check `git status --short` before edits when in doubt.

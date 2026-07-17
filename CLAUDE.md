# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install: `npm i`
- Dev server: `npm run dev`
- Build: `npm run build`

There is no lint, typecheck, or test tooling configured in this repo (no eslint/prettier config, no test runner). Do not assume `npm run lint` or `npm test` exist.

## What this project is

Ripple Design o — a Figma Make-generated code bundle (see `README.md`) for "RippleBox," a referral/rewards app with two personas: salon **clients** and **salon owners**. It's a Vite + React 18 + React Router (data router) SPA styled with Tailwind v4 and shadcn/ui (Radix-based) components. There is no backend for app data — everything is mocked in `src/app/data/mockData.ts`. The one live integration is an AWS Lex chatbot (see below).

Because this originates from Figma Make, `vite.config.ts` has a custom `figma-asset-resolver` plugin that resolves `figma:asset/<file>` imports to `src/assets/<file>`. The React and Tailwind Vite plugins must stay even if a change appears to not need Tailwind — this is a Figma Make platform requirement, not an oversight.

## Architecture

**Two-persona routing split.** `src/app/routes.tsx` defines a single `createBrowserRouter` with top-level auth/onboarding routes (`/`, `/onboarding`, `/login`, `/signup`) and two parallel sub-trees: `/client/*` wrapped in `ClientLayout` and `/salon/*` wrapped in `SalonOwnerLayout`. Each layout renders its own bottom tab nav (different tabs, different accent colors) around a shared `<Outlet />`. When adding a screen, add both the screen component under `src/app/screens/{client,salon}/` and a route entry in `routes.tsx` — routes are not auto-discovered.

**Mock data is the single source of truth for app state.** `src/app/data/mockData.ts` exports `currentUser`, `salons`, and related arrays/helpers (e.g. `getSalonPoints`, `getSalonName`). Screens import directly from here; there is no API client or server. Note the points model is **per-salon, not pooled**: `currentUser.salonPoints` is a list of `{ salonId, points }`, and reward redemption must always check `getSalonPoints(salonId)` for the specific salon rather than a global total. `getTotalLifetimePoints()` exists only for display purposes (e.g. a loyalty badge) and is never a spendable balance.

**Chatbot integration is real, not mocked.** `src/app/components/ChatBubble.tsx` is a floating widget mounted once in `ClientLayout` (available on every client screen, not the salon-owner side). It calls `sendMessageToLex()` in `src/app/lib/lexConfig.ts`, which talks to an AWS Lex V2 bot via `@aws-sdk/client-lex-runtime-v2`, authenticated through a Cognito Identity Pool (`@aws-sdk/credential-provider-cognito-identity`). Bot/pool IDs are read from `VITE_LEX_*` env vars with hardcoded fallbacks to the working demo bot — there is no `.env` file in the repo, so the fallbacks are what's actually used today. A per-tab `sessionId` (random, generated once at module load) keeps Lex conversation context for the session.

**Theming.** `src/app/context/ThemeContext.tsx` provides a light/dark `ThemeProvider` (persisted to `localStorage`, toggles a `dark` class on `<html>`), wrapping the whole router in `App.tsx`. Tailwind dark-mode classes (`dark:...`) are used throughout screens/components rather than a separate theme system. `default_shadcn_theme.css` and `src/styles/theme.css` hold the shadcn design tokens.

**UI components.** `src/app/components/ui/` is the shadcn/ui primitive set (Radix wrappers: dialog, dropdown, tabs, etc.) — treat these as generated/library-like and prefer composing them over editing them. `src/app/components/figma/` holds Figma-import helper components. Feature-specific components (like `ChatBubble`) live directly in `src/app/components/`.

**Import alias.** `@/*` maps to `src/*` (configured in `vite.config.ts`).

# Tracktonaut

Personal metrics tracking PWA built with Next.js 15 and Supabase.

## Project Structure

```
tracktonaut/
├── webapp/          # Next.js 15 PWA application
├── database/        # SQL migrations and seed data
├── supabase/        # Supabase configuration
└── docs/            # Technical documentation
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Supabase account and project
- VAPID keys for Web Push notifications

### Installation

1. Clone the repository and install dependencies:

```bash
npm run install-all
```

2. Set up environment variables:

```bash
cd webapp
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
```

3. Generate VAPID keys for Web Push:

```bash
npx web-push generate-vapid-keys
# Add the keys to .env.local
```

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Milestones

- [x] Milestone 1: Project skeleton with Next.js 15, TypeScript, Tailwind CSS, PWA manifest
- [ ] Milestone 2: Database schema, RLS policies, Supabase clients
- [ ] Milestone 3: RPC functions and Edge Functions
- [ ] Milestone 4: Metrics management UI
- [ ] Milestone 5: Daily check-in capture flow
- [ ] Milestone 6: Dashboard with analytics
- [ ] Milestone 7: Web Push notifications and offline support
- [ ] Milestone 8: Polish, error handling, E2E tests

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **Charts**: Chart.js + react-chartjs-2
- **i18n**: i18next + react-i18next
- **Offline**: IndexedDB (idb) + Service Worker
- **Notifications**: Web Push API with VAPID

## Architecture

Follows trackfolio patterns:
- Service layer with singleton exports
- SSR-compatible Supabase clients (browser + server)
- Type-safe database access with auto-generated types
- App Router with middleware for auth
- RLS-first security model

## License

Private project - not licensed for distribution.

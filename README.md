# Reddit Search Scraper

A full-stack web application to search Reddit posts by keywords, view results in a sortable table, and export data to Excel or Google Sheets — all without requiring a Reddit account.

## Features

- **Keyword Search** — Search Reddit with any keywords, filter by Top or Hot posts
- **No Reddit Account** — Uses Reddit's public JSON endpoints (no authentication needed)
- **Sortable Results** — Up to 100 posts with sortable columns (upvotes, comments, date)
- **Excel Export** — Download results as XLSX with one click (client-side generation)
- **Google Sheets** — Export directly to Google Sheets with formatted headers
- **Rate Limiting** — Built-in rate limiter (1 req/2s) to prevent Reddit bans
- **Caching** — 5-minute in-memory cache for identical queries
- **Dark Mode** — Modern dark theme UI built with shadcn/ui

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** TanStack React Query
- **Excel:** SheetJS (xlsx)
- **Google API:** googleapis
- **HTTP:** Axios

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd reddit-scraper
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
# Required for Google Sheets export (optional — Excel works without this)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/auth/callback

# Secret key for encrypting Google tokens (use any random string)
NEXTAUTH_SECRET=your_random_secret_key_here
NEXTAUTH_URL=http://localhost:3000
```

> **Note:** Reddit search works without any environment variables. Google Sheets export requires Google OAuth credentials.

### Setting Up Google API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google Sheets API** and **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Set Application Type: **Web application**
6. Add Authorized redirect URI: `http://localhost:3000/api/google/auth/callback`
7. Copy the Client ID and Client Secret to `.env.local`

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── reddit/route.ts
│   │   └── google/
│   │       ├── auth/route.ts
│   │       ├── auth/callback/route.ts
│   │       ├── sheets/route.ts
│   │       └── status/route.ts
│   ├── search/page.tsx
│   ├── settings/page.tsx
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   ├── ui/
│   ├── Navbar.tsx
│   ├── Providers.tsx
│   ├── SearchForm.tsx
│   ├── ResultsTable.tsx
│   ├── ExportButtons.tsx
│   └── GoogleAuthButton.tsx
├── hooks/
│   ├── useRedditSearch.ts
│   └── useGoogleAuth.ts
├── lib/
│   ├── cache.ts
│   ├── rate-limiter.ts
│   ├── reddit.ts
│   ├── sheets.ts
│   ├── xlsx-export.ts
│   └── utils.ts
└── types/
    └── index.ts
```

## Deployment (Vercel)

1. Push to GitHub
2. Import to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Update `GOOGLE_REDIRECT_URI` to your production URL
5. Deploy!

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reddit?keywords=...&sort=top\|hot` | Search Reddit posts |
| GET | `/api/google/auth` | Start Google OAuth |
| GET | `/api/google/auth/callback` | OAuth callback |
| GET | `/api/google/status` | Check auth status |
| DELETE | `/api/google/status` | Disconnect Google |
| POST | `/api/google/sheets` | Export to Sheets |

## License

MIT

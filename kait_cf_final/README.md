# KAIT Cloudflare build

This version is prepared for Cloudflare Pages + Pages Functions.

## What changed
- Gemini moved off the frontend and into `functions/api/recommend.ts`
- Live weather and AQI are fetched server-side from Open-Meteo
- Cloudflare cache is enabled for weather and AQI requests
- Frontend now calls `/api/recommend`

## Local run
```bash
npm install
npm run dev
```

## Cloudflare Pages deployment
Framework preset: **Vite**

Build command:
```bash
npm run build
```

Build output directory:
```bash
dist
```

## Required Cloudflare environment variable
- `GEMINI_API_KEY`

## Notes
- Firebase config can stay public in the frontend, but Firestore rules must stay locked down.
- Weather and AQI currently use Open-Meteo, so no extra API key is required for those two sources.

# Lumina

Lumina is a low-pressure social accountability app for emotional fulfillment tracking through AI-assisted journaling and silent social support.

This repository contains a **Phase 1 Web MVP**:

- `apps/web`: React + Vite mobile-first web app
- `apps/api`: Express + TypeScript API with PostgreSQL persistence
- `render.yaml`: Render Blueprint for one-click infrastructure + deployment

## Product pillars included in MVP

1. **Onboarding & Identity**
   - Phone + OTP login flow
   - Editable profile (name, age, location, education, gender)
   - Optional personality profile data storage

2. **Pulse Check-in**
   - Text journal input
   - Optional image upload (OCR path via OpenAI when configured)
   - Fulfillment score (0-100), risk band, and sentiment summary
   - "Did you love your day today?" binary signal

3. **Silent Connection**
   - Add friends by phone
   - Friend mood colors from latest check-in
   - Send "Nudge" (thumbs-up)
   - 100-day mutual interaction eligibility check for messaging unlock
   - Global discovery leaderboard (altruism via nudges sent)

4. **Growth & Support**
   - Daily quote/recommendation based on latest mood
   - Professional support flag when recent risk trend stays high

## Tech stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL
- AI: OpenAI API (with deterministic fallback when unavailable)
- Optional realtime: Redis pub/sub for nudges
- Optional SMS alerts: Infobip SMS API for thumbs-up notifications

## Quick start

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Copy `.env.example` values into Render/local env vars:

- `OPENAI_API_KEY` (optional but recommended)
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `REDIS_URL` (optional)
- `INFOBIP_URL` (optional; e.g. `https://api.infobip.com`)
- `INFOBIP_API_KEY` (optional)

### 3) Run locally

In one terminal:

```bash
npm run dev --workspace apps/api
```

In another terminal:

```bash
npm run dev --workspace apps/web
```

Web defaults to `http://localhost:5173` and API to `http://localhost:8080`.

## API overview

Base path: `/api`

- `POST /auth/request-otp`
- `POST /auth/verify-otp`
- `GET /profile/me`
- `PUT /profile/me`
- `GET /personality/questions`
- `POST /pulse/checkin`
- `GET /pulse/trends`
- `GET /support/recommendation`
- `GET /social/friends`
- `POST /social/friends/add`
- `POST /social/nudge`
- `GET /social/text-eligibility/:friendId`
- `GET /social/discovery`

## Render deployment

The included `render.yaml` provisions:

- `lumina-db` PostgreSQL
- `lumina-api` web service
- `lumina-web` static site

Push to GitHub and use **Render Blueprint deploy**. Auto-deploy will update both services on each push.

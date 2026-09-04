# Gym Chat — personal training coach PWA

An iPhone-first installable web app for live gym coaching and workout tracking.

## Included
- 21-day comeback block with Pull / Push / Legs+Conditioning / Upper rotation
- set-by-set workout mode
- 90-second rest timer
- local persistent history (browser storage)
- pull-up and dip PR tracking
- recent-set history and streak count
- chat interface
- speech-to-text when the browser supports it
- optional OpenAI Responses API backend
- offline PWA shell

## Run locally
1. Install Node.js 20+.
2. In this folder:
   npm install
3. Copy `.env.example` to `.env`.
4. Add your OpenAI API key to `.env`.
5. Run:
   npm start
6. Open http://localhost:3000

Without an API key the app still works using its built-in local coach fallback.

## Install on iPhone
For Home Screen installation the app must be served over HTTPS (localhost is fine for development on the same machine, but not for normal iPhone use).
Deploy it to a host such as Vercel/Render/Railway or your own HTTPS server, open it in Safari, tap Share → Add to Home Screen.

## Important security note
Never put an OpenAI API key in `public/app.js`. Keep it only on the server in `.env`.

## Next upgrades
- proper user account + cloud database so training history follows you across devices
- richer exercise library and editable programme
- weight/RPE/assistance logging
- charts for pull-ups, dips, running and bodyweight
- realtime voice conversation
- photos/progress measurements
- HealthKit bridge through a native iOS wrapper

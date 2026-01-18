## Kids Geo

Kids Geo is a tablet-first learning app for kids to explore geography.

The first version focuses on an interactive world map:

- Colorful continents rendered as an SVG world map
- Tap a continent to hear its name using the browser Text-to-Speech API
- A large label appears on the tapped continent for 5 seconds
- Layout is responsive, optimized for tablets but works on phones and desktop

The app is built with [Next.js](https://nextjs.org) (App Router) and React.

## Getting Started

To run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the main screen by modifying `app/page.tsx`. The world
map logic lives in:

- `app/components/world-map.tsx` – interactive SVG world map and TTS behavior
- `lib/geo/continents.ts` – continents data and shapes

## Progressive Web App (PWA)

Kids Geo is configured as a basic PWA so that it can be installed on tablets
and work offline for core experiences.

Key pieces:

- `app/manifest.ts`
  - Exposes `/manifest.webmanifest` with app name, colors, and icon
- `public/sw.js`
  - Service worker that:
    - Pre-caches `/` and `/favicon.ico`
    - Uses a cache-first strategy for static assets
    - Falls back to the cached home page for navigation when offline
- `app/components/pwa-register.tsx`
  - Client-side component that registers the service worker at `/sw.js`
  - Only runs when `navigator.serviceWorker` is available and the page is
    served over HTTPS or on `localhost`
- `app/layout.tsx`
  - Imports and renders `PwaRegister` once at the root
  - Defines `metadata` with title, description, theme color, and manifest path

With this setup, when you build and deploy the app over HTTPS:

- Browsers can install it to the home screen
- Static assets and the home page are cached for offline use

## Future Features

Planned additions include:

- Second screen with a list of continents
- Drilling into each continent to show its countries, capitals, and flags
- More game-like interactions for kids (quizzes, drag-and-drop, etc.)

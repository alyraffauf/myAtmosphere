# myAtmosphere

A simple web app to browse my Bluesky posts with infinite scroll.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Building

```bash
npm run build
```

The built files go in the `dist` folder.

## What it does

- Shows posts from aly.ruffruff.party in chronological order
- Filters out replies (except self-replies)
- Infinite scroll to load more posts
- Click any post to view it on bsky.app

Built with React + Vite.
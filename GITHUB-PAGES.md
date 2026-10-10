# GitHub Pages

Live: https://suvsha1029-debug.github.io/autzen-lidar-map/

The Pages edition runs entirely in the browser and includes the existing survey
data. It does not require ChatGPT sign-in or a Cloudflare server.

Build with Node.js 22.13 or newer:

```sh
npm ci
npx vite build --config vite.pages.config.ts
```

Copy the contents of `pages-dist` into `docs`, retaining `docs/.nojekyll`, then
commit and push. Pages publishes `/docs` from the `main` branch.

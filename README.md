# shadowfax-505.github.io

Personal site of Muttakin Rahman: embedded systems, full-stack web and research.
Live at **https://shadowfax-505.github.io**.

Built with [Astro](https://astro.build), plain CSS and a little three.js. No trackers, no cookies, no backend.

## Run it

Node 22 or later.

```sh
npm ci
npm run dev        # http://localhost:4321
npm run build      # static site in dist/
npm test           # content and structure checks on dist/
npm run verify:links   # same, plus every external link
```

Pushing to `main` deploys through GitHub Actions (`.github/workflows/deploy.yml`).

## Change things

| To change | Edit |
| --- | --- |
| Name, email, availability line, services, skills, recognition, community, "also built", press | `src/data/profile.ts` |
| A project case study | `src/content/work/<slug>.md` |
| A research entry | `src/content/research/<slug>.md` |
| Status words (Shipped, Simulated, Hardware pending …) | `src/data/status.ts` |
| Colours, type, spacing, light/dark | `src/styles/global.css` (tokens at the top) |
| Home page sections | `src/pages/index.astro` |
| CV layout (print with Ctrl/Cmd+P) | `src/pages/cv/index.astro` |

### Add a project

1. Copy `src/content/work/zenflow.md` to `src/content/work/<new-slug>.md`.
2. Fill in the frontmatter: `kind: selected` for the main grid, `order` for position, `statuses` from `src/data/status.ts`.
3. Put screenshots in `public/assets/` as `.webp` (plus a `-640.webp` copy for the home card) and reference them in `cover` / `figures`.
4. `npm run build && npm test`.

### Publish a note

Copy `src/content/notes/_template.md`, rename it, set `draft: false`. A Notes link appears in the header once one note is published.

### Update a status

When something moves from simulated to measured, change the `statuses` list and the metric's `status`, and rewrite the sentence that says what is pending. `npm test` checks that the AFO page still says what is unmeasured, so update `scripts/verify-content.mjs` when the bench results arrive.

## Rules the content follows

- Every claim names how it is known: shipped, tested in software, simulated, pending on hardware, or under review.
- Unpublished research shows the question, the method and the status. Results go up with the paper.
- No images of things that do not exist. The drone page links the 2019 newspaper report and labels its 3D model as a reconstruction.

Asset sources: [`docs/ASSET_NOTES.md`](docs/ASSET_NOTES.md).

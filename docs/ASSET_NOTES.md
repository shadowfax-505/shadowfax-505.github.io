# Where every image and chart comes from

Nothing on the site is a stock image or a generated picture of a project. Each asset below is either a capture of real software, a render of a real design file, or a chart drawn from real data at build time.

| Asset | Source | What it is |
| --- | --- | --- |
| `public/assets/afo/board-render*.webp`, `board-top.webp` | `afo-recorder` repo, `designs/ad7606-two-channel-icm42688/viewer/main.glb` (KiCad 3D export) | Render of the real PCB model with three.js (RoomEnvironment light, transparent background), trimmed with sharp. Not a photograph. |
| `public/assets/afo/assembly-drawing.webp` | same design, `manufacturing/main/assembly.svg` (KiCad export) | Rasterised assembly drawing. |
| `public/assets/afo-precision-viewer.webp` | `afo-recorder` repo, `docs/precision-viewer.png` | Capture of the browser assembly guide. |
| `src/data/afo/logic-window.json` | `simulations/integrated-recorder/results/web-1.12/normal/logic.vcd.gz` | 310 µs window from the Wokwi logic analyzer (firmware ad7606-2ch-1.12), extracted with `scripts/data/extract-logic.py`. Simulated, not measured. |
| `src/data/afo/frequency-response.json` | `simulations/results/response.csv` | ngspice AC sweep of the anti-alias front end. Simulated. |
| `public/assets/researchhub-*.webp` | ResearchHub repo, Playwright snapshots in `web/tests/researchhub.spec.ts-snapshots/` and the redesign PR | Captures of the app running locally against Oracle with seeded records. |
| `public/assets/civiclens-*.webp` | Local CivicLens checkout, captures from July 2026 | Captures of the app running locally with seeded records. |
| Drone model (`src/scripts/drone.ts`) | Code-built three.js geometry | Reconstruction of an F450-class quad. The 2019 build is documented only by the Dainik Shiksha article (1 April 2019); no photos survive. |
| Particle field (`src/scripts/hero.ts`) and its SVG fallback | Code | Decorative. The EMG form is a drawn pattern, not recorded data. |
| `public/og.png` | `scripts/create-social.mjs` | Social card rendered with the site fonts and the board render. |

To regenerate the AFO logic data after a new Wokwi run:

```sh
python3 scripts/data/extract-logic.py <path-to>/logic.vcd.gz src/data/afo/logic-window.json 300
```

Fonts: IBM Plex Sans, Serif and Mono, self-hosted through Fontsource under the SIL Open Font License 1.1.

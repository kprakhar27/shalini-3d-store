# Shalini AI-Powered 3D Store

Submission for the Shalini AI 3D-Store assignment — a browser-based prototype of an AI-powered 3D shopping experience.

The assignment asks for a minimal demo around an interactive 3D environment, smooth transitions, product viewing, variants, a visual add-to-cart, and at least one AI/ML application for 3D assets. This submission implements every required item plus a working end-to-end AI pipeline (real models, not simulated) and a Firestore-backed admin panel for editing the catalogue live.

---

## Demo flow (in 60 seconds)

1. **Home** — four floating category objects (Living Room, Bedroom, Dining Room, Office) on an infinite grid. Hover scales them, click triggers a transition.
2. **Transition** — a hand-crafted "black hole" effect: the home scene contracts into a swirling singularity with light streaks pulled inward, peaks at a white flash that masks the scene swap, then the new scene unfurls outward from a point. ≈1.8 s, paired CSS canvas distortion + 2-D canvas overlay.
3. **Category page** — a single scrollable page with one rotating carousel per subcategory of the chosen category. Wheel scrolls between subcategories with snap-to-section; horizontal drag rotates the centred carousel independently. Big top-left subcategory wordmark crossfades as you scroll.
4. **Product viewer** — click any product, the carousel snap-rotates to bring it front-and-centre, then the camera zooms in. Rotate / zoom via OrbitControls. Hover the product to summon a Nike-style overlay card with description and price.
5. **Variants** — click a colour swatch in the bottom bar; the active variant tints the GLB (multiplied with the original PBR colour to preserve textures) in real time.
6. **Add to Cart** — animated coloured ball arcs from the centre of the viewer into the cart icon, the badge bumps. Click the cart to slide a drawer in from the right with quantity steppers + remove buttons + running total.
7. **Admin & AI** — top-left **Admin & AI** button opens a panel explaining the pipeline and showing test-account credentials. `/admin/login` → upload a product photo → background is automatically removed (rembg) → image is sent to a Hugging Face Space (Hunyuan3D-2) which generates a textured GLB → the URL is written to Firestore → the storefront viewer swaps in the new mesh via `onSnapshot`. All hands-off after the upload.

---

## Mapping to the assignment

| Requirement | Where it lives |
|---|---|
| **Home scene with 3–4 clickable category objects** | Four procedural meshes in a circle on a grid floor — [`HomeScene.tsx`](frontend/src/scenes/HomeScene.tsx), [`CategoryObject.tsx`](frontend/src/components/CategoryObject.tsx). Categories can also display real GLBs when set in the admin. |
| **Smooth transition (wormhole / tunnel / camera anim)** | Black-hole implosion / emerge — [`WormholeOverlay.tsx`](frontend/src/components/WormholeOverlay.tsx). Pairs a 2-D canvas (event-horizon ring + 140 light streaks accelerating inward) with a CSS transform/blur on the underlying R3F canvas. |
| **Category scene with at least 1 category + 1 subcategory** | Implemented for every category, with N subcategories per category. Each subcategory gets its own scroll-snap section. [`ProductScene.tsx`](frontend/src/scenes/ProductScene.tsx) (the page is a stack of carousel groups). |
| **Product listing — 5-6 products in circular/arc, rotate via mouse/scroll** | Each subcategory carousel uses [`utils/carousel.ts`](frontend/src/utils/carousel.ts) for circular layout. Wheel/drag rotates the centred carousel; angles are persisted per-subcategory in the store. |
| **Product viewer — center, rotate, zoom, basic lighting** | Click → carousel rotates that card to front, then the camera lerps from `(0, 1, 9)` to `(0, 0.2, 5.5)` with FOV change. Studio lighting (directional + ambient + accent point lights). Drei `OrbitControls` for rotate/zoom. |
| **Variants — 2-3 per product, change via color/texture/model swap** | Variants live on each product in Firestore. Swatches in the bottom bar swap the active variant; the colour multiplies into the GLB's existing material color so PBR textures stay intact. |
| **Add to Cart — visual animation only** | Coloured ball arcs from viewer-centre into the cart icon (framer-motion bezier) with a badge bump on landing. No backend cart — items live in Zustand. The cart icon is now also clickable, opens a slide-in drawer with quantity controls. |
| **AI/ML — pretrained model for image-to-3D OR pipeline OR simulation** | Real, working pipeline. See *AI/ML* section below. |

---

## Tech stack

| Layer | Library |
|---|---|
| 3-D renderer | React Three Fiber (`@react-three/fiber`) |
| 3-D helpers | drei — `OrbitControls`, `useGLTF`, `MeshTransmissionMaterial`, `Text` |
| Three.js core | three.js + `maath` (easing) |
| State | Zustand |
| UI animation | framer-motion + `@react-spring/three` |
| Routing | react-router-dom |
| Realtime data | Firebase JS SDK (Firestore `onSnapshot`) |
| Auth | Firebase Auth (email / password) |
| Build | Vite + TypeScript |
| API | FastAPI + Pydantic |
| Firestore (server) | Direct REST via `httpx` (gRPC bypassed — see Notes) |
| Storage | Cloudflare R2 (S3-compatible) via `boto3` |
| Background removal | [rembg](https://github.com/danielgatis/rembg) — local U²-Net (ONNX) |
| Image-to-3D | [Hunyuan3D-2](https://huggingface.co/spaces/tencent/Hunyuan3D-2) via `gradio_client`, with TRELLIS / TripoSR fallback |

---

## AI/ML

The "AI Pipeline" panel in the storefront documents the conceptual flow; the actual implementation runs *real models on real photos* end-to-end. The mandatory AI/ML requirement is satisfied by **option B** (a pretrained image-to-3D model) — and additionally option A (a basic pipeline showing each stage) is exposed visually in the admin panel and the AI-Pipeline modal.

### Pipeline

```
Browser (admin)                                 Backend (FastAPI)                     External
      │                                                  │                                  │
 ① drag/drop      ─presigned PUT─▶  Cloudflare R2        │                                  │
      │                                                  │                                  │
 ② auto-trigger   ─POST /generate-bg-remove──▶  rembg (U²-Net, local CPU)                  │
      │                                                  │                                  │
      │                                          uploads cleaned PNG → R2                   │
      │                                                  │                                  │
 ③ auto-trigger   ─POST /generate-3d─────────▶  Hunyuan3D-2 via gradio_client ────────────▶ HF Space
      │                                                  │                                  │
      │                                          downloads GLB from Space                   │
      │                                          uploads GLB → R2                           │
      │                                          writes glbUrl → Firestore                  │
      │                                                  │                                  │
 ④ Firestore onSnapshot ──▶ storefront useGLTF ──▶ viewer swaps placeholder for real mesh  │
```

### What each step actually does

1. **Background removal** — `rembg` 2.0 with the U²-Net ONNX weights runs on the FastAPI server (CPU, ~1–3 s per image). Produces a transparent-background PNG which is the canonical input for image-to-3D models.
2. **Image-to-3D** — Tencent's [Hunyuan3D-2](https://huggingface.co/spaces/tencent/Hunyuan3D-2) is the primary model. We call its public Hugging Face Space via `gradio_client`'s `/generation_all` endpoint (geometry + PBR textures) with a fallback to `/shape_generation` (geometry only) if the textured pipeline is rate-limited. The backend auto-detects the Space's API surface, so swapping to TRELLIS or TripoSR via the `HF_3D_SPACE` env var works without code changes.
3. **Auto-pipeline** — In `/admin/products`, every image upload kicks off the full chain (R2 → rembg → Hunyuan3D-2) without any further user action. The `Generate 3D` and `Remove BG` buttons remain on each thumbnail for manual retry.
4. **Live propagation** — once the GLB URL lands in Firestore, drei's `useGLTF` hook in the storefront swaps the box placeholder for the real mesh in seconds via `onSnapshot`. No reload, no admin action.

### Why this design
- **No GPU required locally** — Hunyuan3D-2 runs on Hugging Face's ZeroGPU; we only need a free HF token to lift the unauthenticated rate limit.
- **Graceful fallback** — three image-to-3D APIs are supported (Hunyuan3D-2, TRELLIS, TripoSR). The backend tries them in order so a single broken Space (RUNTIME_ERROR / sleeping) doesn't block generation.
- **Clear separation of concerns** — anything requiring secret keys (HF token, rembg local execution) lives behind FastAPI; reads (Firestore) and uploads (R2) happen directly from the browser via SDKs / presigned URLs.

### Conceptual pipeline (the *option-A* view)

The "AI Pipeline" button in the storefront opens a full diagram of how a multi-view image-to-3D system would work end-to-end (multi-view capture → SfM → NeRF / Instant-NGP → Marching Cubes → texture baking → glTF export). Even though this submission uses single-image feed-forward models (Hunyuan3D-2, TRELLIS, TripoSR) which short-circuit most of those stages with a diffusion prior trained on Objaverse, the panel explains the canonical photogrammetry flow for completeness.

---

## How to run

The repo is split into two independently-deployable halves:

```
shalini-3d-store/
├── frontend/    Vite + React + R3F + Firebase JS SDK
└── backend/     FastAPI + rembg + gradio_client + boto3
```

### Quick start

```bash
# 1. Frontend
cd frontend
npm install
cp .env.local.example .env.local      # fill in (see below)
npm run dev                            # → http://localhost:5173

# 2. Backend (in a separate terminal)
cd ../backend
python3.10 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                   # fill in (see below)
uvicorn app.main:app --reload          # → http://localhost:8000
```

Open http://localhost:5173 for the storefront, http://localhost:5173/admin/login for the admin panel.

### Configuration

Two env files are required:
- **`frontend/.env.local`** — Firebase web-SDK config (apiKey, authDomain, projectId, messagingSenderId, appId) + the backend URL.
- **`backend/.env`** — Firebase Admin credentials (service account), Cloudflare R2 keys, Hugging Face token, CORS origins.

Templates are at [`frontend/.env.local.example`](frontend/.env.local.example) and [`backend/.env.example`](backend/.env.example). Working values for the live demo (Firebase project, R2 bucket, HF token, R2 CORS) **are sent separately** to keep secrets out of the repo. Once both files are filled in, the `npm run dev` and `uvicorn` commands above bring everything up.

### Test admin account

```
email:    testuser@test.com
password: test1234
```

Sign in at `/admin/login`. From there: edit categories / subcategories / products, drag-drop a product photo, and the auto-pipeline runs — the storefront viewer swaps in the generated GLB ~1–3 minutes later.

---

## Project structure (high level)

```
frontend/src/
├── App.tsx                           Routes: storefront + /admin/*
├── store/useStore.ts                 Zustand (scene state, cart, carousels, scroll)
├── data/                             Static fallbacks + TypeScript types
├── lib/firebase/client.ts            Firebase init (lazy if not configured)
├── lib/hooks/                        Real-time Firestore subscriptions
├── scenes/
│   ├── HomeScene.tsx                 Procedural categories + grid floor
│   └── ProductScene.tsx              Multi-carousel page + viewer + variant tinting
├── components/
│   ├── WormholeOverlay.tsx           Black-hole transition
│   ├── ProductCard.tsx               Carousel card with GLB or placeholder
│   ├── ProductListingOverlay.tsx     Viewer overlay (Nike-style)
│   ├── SubcategoryHeading.tsx        Top-left big heading on the carousel page
│   ├── HomeBrand.tsx                 SHALINI 3D STORE wordmark
│   ├── CartUI.tsx                    Flying ball + side drawer
│   ├── DataProvider.tsx              Syncs Firestore → Zustand
│   └── AIPipelinePanel.tsx           "How it works" modal with admin link
└── admin/
    ├── AdminApp.tsx                  /admin/* router + auth guard
    ├── DashboardPage.tsx             Stats + recent jobs
    ├── CategoriesPage.tsx            CRUD with subcategory inline
    ├── ProductsPage.tsx              CRUD + filters + image uploader + auto pipeline
    └── ImageUploader.tsx             Drag-drop → presigned PUT → R2

backend/app/
├── main.py                           FastAPI app + CORS + router mounts
├── routers/
│   ├── products.py                   /products  CRUD
│   ├── categories.py                 /categories  CRUD
│   ├── storage.py                    /storage/presigned-upload (R2)
│   └── generation.py                 /generate-bg-remove, /generate-3d, /jobs/{id}
└── services/
    ├── firebase.py                   Firestore via REST
    ├── r2.py                         Cloudflare R2 (boto3)
    ├── remove_bg.py                  rembg (lazy import)
    └── local_3d.py                   Hunyuan3D-2 / TRELLIS / TripoSR auto-dispatch
```

---

## Notes on engineering choices

- **R2 over Firebase Storage** — Firebase Storage now requires the paid Blaze plan even for the free tier. R2 has 10 GB on the actual free tier (no card required), and is S3-compatible so boto3 / browser presigned-PUT both just work.
- **Firestore via REST instead of gRPC** — the official Python SDK uses gRPC which can hang on networks with strict HTTP/2 keepalive policies (some VPNs / corporate proxies). The backend talks to Firestore over the REST API directly via `httpx`. The chain API (`db().collection(...).document(...).get()`) is preserved through small proxy classes, so router code is unaffected.
- **Multiple Spaces** — `HF_3D_SPACE` accepts a comma-separated list, the backend auto-detects each Space's API and falls through to the next on failure. Default: `tencent/Hunyuan3D-2,microsoft/TRELLIS,stabilityai/TripoSR`.

---

## Beyond the brief

The brief is intentionally minimal. Things in this submission that go past it:

- **Admin panel** with Firebase Auth + CRUD for categories / subcategories / products with images, including a dashboard with live stats and a category/subcategory product filter.
- **Real-time storefront** — every change in admin propagates to the storefront within a second via Firestore `onSnapshot`. No reload, no manual sync.
- **Real AI pipeline** end-to-end (rembg → Hunyuan3D-2) with auto-pipeline on upload, plus graceful fallback across three image-to-3D model providers.
- **Multi-carousel category page** — one rotating carousel per subcategory stacked vertically, with snap-to-section scroll. The brief asks for one subcategory; this shows N seamlessly.
- **Cart drawer** with quantity steppers and remove buttons (the brief asks only for a flying-icon animation).
- **Variant tinting on GLBs** — variant colours multiply into the loaded GLB's material colour, preserving any PBR textures rather than replacing them.

If reviewers want to focus on the assignment minimum, the home → category → viewer flow with placeholder geometry exercises every required item independently of the AI pipeline.

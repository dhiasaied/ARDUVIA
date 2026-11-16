# ARDUVIA

> An interactive 3D learning platform for Arduino beginners: illustrated workbenches, a real in-browser
> sketch interpreter, auto-verified challenges, gamified progress and an AI learning assistant, in English,
> French, Spanish and Arabic.

![Angular](https://img.shields.io/badge/Angular-20.3-DD0031?logo=angular&logoColor=white)
![Symfony](https://img.shields.io/badge/Symfony-7.3-000000?logo=symfony&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-%E2%89%A5%208.2-777BB4?logo=php&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![three.js](https://img.shields.io/badge/three.js-0.180-000000?logo=three.js&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-3.13-88CE02?logo=greensock&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-Doctrine%20ORM-003B57?logo=sqlite&logoColor=white)

---

## Table of Contents

1. [Overview](#overview)
2. [Project Objectives](#project-objectives)
3. [Features](#features)
4. [Technologies Used](#technologies-used)
5. [UI/UX Design](#uiux-design)
6. [Project Architecture](#project-architecture)
7. [Installation](#installation)
8. [Getting Started](#getting-started)
9. [Project Structure](#project-structure)
10. [Configuration](#configuration)
11. [Screenshots & Preview](#screenshots--preview)
12. [Video Presentation](#video-presentation)
13. [Performance & Optimization](#performance--optimization)
14. [Responsive Design](#responsive-design)
15. [Security](#security)
16. [Future Improvements](#future-improvements)
17. [Author](#author)
18. [License](#license)

---

## Overview

**ARDUVIA** teaches the fundamentals of Arduino electronics and programming through **16 progressive
lessons**, from discovering the Arduino Uno to building a complete ultrasonic parking sensor.

Every lesson combines four elements:

- an **explorable 3D workbench**, built procedurally with three.js, showing the Uno, a breadboard and the
  lesson's components;
- **structured content** in five tabs: Overview, Pinout, Example (a code walkthrough), Specs and a
  hands-on **Challenge**;
- an **editable code editor** whose sketch is executed by a purpose-built Arduino C++ interpreter that
  drives a virtual Uno, so LEDs light up, motors spin, buzzers play and the serial monitor prints output;
- a **learning assistant** that explains code, decodes errors and gives hints.

Progress, settings, activity, XP and achievements are stored by a Symfony REST API for anonymous learners,
so no account is needed. The interface is fully localized in **English** (default), **French**,
**Spanish** and **Arabic**, with a complete right-to-left layout for Arabic.

---

## Project Objectives

| Objective | How ARDUVIA addresses it |
|---|---|
| Make electronics approachable | Illustrated, rotatable 3D benches with labelled parts, a part inspector and an animated current flow |
| Learn by doing | Learners edit real Arduino code and immediately see its effect on a simulated circuit |
| Turn practice into mastery | One challenge per lesson, verified automatically from the circuit's behaviour |
| Sustain motivation | XP, levels, achievements, day streaks and a learning dashboard |
| Support learners when they are stuck | An AI tutor (Claude) with a built-in offline fallback |
| Teach debugging, not only syntax | Live diagnostics, breakpoints, step-by-step execution and a variable watch |
| Reach learners in their own language | Four languages, localized URLs and full right-to-left support |

---

## Features

### Lessons

| # | Lesson | Main concept | Challenge |
|---|---|---|---|
| 1 | Meet the board | Anatomy of the Arduino Uno | Make the built-in L LED blink |
| 2 | Blink an LED | `digitalWrite`, `delay` | Blink at least twice as fast |
| 3 | Press a button | `digitalRead`, `INPUT_PULLUP` | Invert the button logic |
| 4 | Turn a knob | `analogRead`, `map`, PWM | Print the position as a percentage |
| 5 | Mix colours | RGB LED, custom functions | Show purple |
| 6 | Sense light | Photoresistor, thresholds | Light the LED in the light, not the dark |
| 7 | Read a sensor | PIR motion sensor, Serial | Count and print the detections |
| 8 | Make sound | `tone`, arrays, `for` loops | Play A4 at 440 Hz |
| 9 | Mini piano | Multiple inputs, `tone` / `noTone` | Retune a key to 440 Hz |
| 10 | Drive a motor | Transistor, PWM speed | Hold a steady half speed |
| 11 | Measure heat | TMP36, `float` arithmetic | Lower the alarm to 25 °C |
| 12 | Sweep a servo | `Servo.h` | Sweep only between 45° and 135° |
| 13 | Spin the wheel | `Stepper.h`, ULN2003 | Turn one full revolution |
| 14 | Smart plant | Soil moisture sensor | Print a "water me" warning |
| 15 | Measure force | FSR, LED gauge | Print the gauge level |
| 16 | Build a project | HC-SR04 parking sensor | Print the distance with its unit |

All lesson text, challenges, hints, labels and part descriptions exist in all four languages.

### Interactive 3D workbench
- Toon-shaded, ink-outlined isometric scenes generated procedurally (no external 3D assets).
- Navigation: drag or **WASD** to pan, **Q / E** to rotate in quarter turns, wheel or pinch to zoom, reset view.
- Floating labels with overlap avoidance, a part inspector, a minimap, a generated circuit schematic and an
  animated current flow with live HIGH / LOW / PWM chips on the wires.
- **Dynamic lighting**: lit LEDs cast coloured light onto the board and breadboard, within a key/fill/rim
  lighting setup.
- Hands-on inputs: press buttons, turn the potentiometer, cover the photoresistor, trigger the PIR sensor,
  warm the TMP36, water the plant, press the force sensor, drag the obstacle, and play the piano with
  keys **1–4**.

### Code editor and simulator
- Syntax highlighting, line numbers, smart indentation, and auto-closing brackets and quotes.
- **Autocomplete** for the Arduino API and the sketch's own variables and functions (**Ctrl+Space**).
- **Live diagnostics**: the sketch compiles in the background while you type, with a wavy underline on the
  faulty line and a status bar.
- A custom **Arduino C++ interpreter** (tokenizer, parser, asynchronous evaluator) covering globals, arrays,
  functions, loops, ternaries, C-like int/float semantics, `Serial`, digital and analog I/O, `map`, `tone`,
  `pulseIn`, `Servo` and `Stepper`, with compiler-style errors and line numbers.
- **Debugger**: breakpoints (click a line number), pause, resume, step, and simulation speed from 0.25× to 2×.
- A resizable **serial monitor** and a **Variables** tab that shows global variables live.
- Edited code is kept per lesson, with a one-click restore; **Ctrl+Enter** runs the sketch.

### Challenges, gamification and analytics
- **Automatic challenge verification** from pin timings, PWM levels, tones, servo angles, stepper turns
  and serial output.
- **XP and levels**: completed lesson +100, solved challenge +150, fixed bug +25, sketch run +5 (up to 10
  per day), tutor question +2 (up to 5 per day). Ten level titles from *Novice* to *Legend*.
- **10 achievements**: first run, first lesson, five lessons, all lessons, first challenge, five challenges,
  bug hunter, curious mind, three-day streak and sensor pro.
- **Day streaks** (current and best).
- **Learning dashboard**: level ring, XP, streak, stats, a 14-day activity chart, a lesson map and the
  achievement gallery.
- Animated **celebrations** (toasts and confetti) for XP gains, level-ups, achievements and solved challenges.

### AI learning assistant
- Quick actions (**Explain my code**, **Why doesn't it work?**, **Hint for the challenge**) and free-form
  questions, answered in the learner's language.
- The assistant receives the lesson context, the current sketch, the last error and recent serial output.
- **Claude-powered** (`claude-opus-5-5`) when `ANTHROPIC_API_KEY` is configured on the server.
- A built-in **offline tutor** answers otherwise, and whenever the API is unavailable or declines a request.
  It explains the simulator's error messages, walks through the lesson and gives challenge hints in all four
  languages.

### Progress, settings and localization
- Anonymous learner profiles identified by a UUID token stored in the browser.
- A lesson is marked complete after its sketch has run successfully for about 2.5 seconds.
- Settings synced to the API: labels, current flow, floor grid, turntable, sound and reduced motion.
- Localized URLs (`/en/...`, `/fr/...`, `/es/...`, `/ar/...`), a language selector in the sidebar and in
  settings, and a remembered language preference. The bare `/` URL opens the last chosen language (English
  by default).
- Localized page titles and meta descriptions.
- If the API is unreachable, the app keeps working with a local cache and shows an offline indicator.

---

## Technologies Used

### Frontend

| Technology | Version | Role |
|---|---|---|
| Angular (standalone components, signals) | 20.3 | Application framework |
| TypeScript | 5.9 | Language |
| RxJS | 7.8 | HTTP and router streams |
| three.js | 0.180 | WebGL 3D rendering |
| GSAP | 3.13 | Interface motion: entrances, transitions, count-ups, confetti |
| SCSS | — | Styling with design tokens, partials and mixins |
| Web Audio API | — | Buzzer sound synthesis |
| Google Fonts | — | Plus Jakarta Sans, Inter, JetBrains Mono, Noto Sans Arabic |

### Backend

| Technology | Version | Role |
|---|---|---|
| PHP | ≥ 8.2 | Runtime |
| Symfony | 7.3 | Framework (HttpKernel, Routing, Console, Validator, Serializer) |
| Doctrine ORM / Migrations | ORM 3.8 | Persistence and schema migrations |
| SQLite | — | Database (`backend/var/data.db`) |
| Symfony UID | 7.3 | UUID v4 learner tokens |
| Symfony RateLimiter + Lock | 7.3 | Per-learner limit on assistant questions |
| NelmioCorsBundle | 2.6 | Cross-origin requests |
| Anthropic PHP SDK | 1.8 | Claude-powered learning assistant (optional) |
| PHPUnit | 11.5 | Backend unit and functional tests |
| Symfony MakerBundle | dev | Code generation (development only) |

---

## UI/UX Design

ARDUVIA uses an illustrated "workbench" aesthetic in a calm, eye-friendly **Soft Sage & Cream** palette,
with frosted-glass panels, soft shadows, subtle borders and rounded corners.

| Role | Token | Value |
|---|---|---|
| Background | `--bg` | `#F5F5EF` |
| Cards | `--card` | `#FFFFFF` |
| Secondary surfaces | `--surface` | `#E5E9DF` |
| Primary | `--teal` | `#52796F` |
| Secondary accent | `--accent` | `#A8B9A1` |
| Text | `--navy` | `#263D38` |
| Borders | `--line` | `#DCE2D8` |
| Success | `--success` | `#668C70` |
| Warning | `--warning` | `#C58B55` |
| Error | `--danger` | `#BD6862` |

- **Typography:** *Plus Jakarta Sans* for headings and labels, *Inter* for interface text, *JetBrains Mono*
  for code, and *Noto Sans Arabic* for Arabic glyphs. Letter-spacing is removed in Arabic so that letters
  join correctly.
- **Surfaces:** glass panels (`backdrop-filter`) over a soft aurora gradient background, and gradient
  primary actions.
- **Motion:** GSAP drives the interface's entrance on load, panel and dashboard transitions, lesson changes,
  count-ups, toasts and confetti. Every animation is disabled when the learner enables *Reduce motion* or the
  operating system requests it.
- **Branding:** the ARDUVIA mark (a chip carrying an "A") appears in the header, the loader and the favicon.
  The 3D scenes keep realistic hardware colours.
- **Accessibility:** ARIA roles and labels on navigation, tabs, dialogs, the editor (combobox autocomplete)
  and progress bars; keyboard navigation and shortcuts; visible focus rings; `aria-live` regions for the
  serial monitor, the assistant and celebrations.

---

## Project Architecture

```
┌────────────────────────────── Browser (Angular 20) ──────────────────────────────┐
│  UI ─────────── Shell · Sidebar/Flyouts · Stage · InfoCard (5 tabs) · CodeCard ·    │
│                 LessonStrip · AssistantPanel · Dashboard · Celebrations            │
│  Core ───────── LessonStore · LearnerService · GamificationService ·               │
│                 ChallengeService · I18n · UiState · ApiService                     │
│  Simulation ─── Interpreter (Arduino C++ subset + debugger) ⇄ SimService (Uno)     │
│  3D ─────────── SceneEngine (three.js) · Benches · Board · Kit                      │
│  Motion ─────── GSAP helpers (reduced-motion aware)                                │
└─────────────────────────────────────┬──────────────────────────────────────────────┘
                                      │ JSON over HTTP (/api, proxied in development)
┌─────────────────────────────────────▼──────────── Symfony 7.3 ─────────────────────┐
│  Controllers ── LessonController · LearnerController · AssistantController         │
│  DTOs ───────── SettingsInput · ProgressInput · EventInput · AssistantInput        │
│  Services ───── LessonImporter · LessonPresenter · ProgressTracker · Gamification · │
│                 LearningAssistant (Claude) · LocalTutor (offline fallback)         │
│  Entities ───── Lesson · LessonTranslation · Learner · LessonProgress ·            │
│                 ActivityEvent                                                      │
│  Infra ──────── ApiExceptionSubscriber · RateLimiter · app:lessons:import          │
└─────────────────────────────────────┬──────────────────────────────────────────────┘
                                      ▼
                        SQLite (Doctrine ORM)  ·  Anthropic API (optional)
```

Gamification is **derived, not stored**: XP, levels, streaks and achievement unlock dates are computed from
lesson progress and the activity log, so the rules can change without data migrations.

### REST API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service status and lesson count |
| `GET` | `/api/locales` | Supported locales and text direction |
| `GET` | `/api/lessons?locale=en` | Ordered lesson catalogue |
| `GET` | `/api/lessons/{slug}?locale=en` | Full lesson: content, code and challenge |
| `POST` | `/api/learners` | Create an anonymous learner (returns a token) |
| `GET` | `/api/learners/{token}` | Profile: locale, settings, progress |
| `PATCH` | `/api/learners/{token}/settings` | Update settings and locale (validated) |
| `GET` | `/api/learners/{token}/progress` | Progress snapshot |
| `PUT` | `/api/learners/{token}/progress/{slug}` | Record a run or a completion |
| `DELETE` | `/api/learners/{token}/progress` | Reset progress and activity |
| `POST` | `/api/learners/{token}/events` | Record a run, error, fixed bug or solved challenge |
| `GET` | `/api/learners/{token}/dashboard` | XP, level, streaks, achievements and 14-day activity |
| `GET` | `/api/assistant/status` | Whether the Claude-powered tutor is enabled |
| `POST` | `/api/assistant` | Ask the learning assistant (validated and rate-limited) |

Errors are returned as JSON, for example a validation failure (HTTP 422):

```json
{
  "status": 422,
  "error": "Validation failed",
  "violations": [{ "field": "locale", "message": "Unsupported locale." }]
}
```

---

## Installation

### Prerequisites

| Tool | Notes |
|---|---|
| PHP **8.2+** | With `pdo_sqlite`, `ctype`, `iconv`, `mbstring` and `xml` |
| Composer 2 | PHP dependency manager |
| Symfony CLI | Recommended local web server |
| Node.js and npm | Angular toolchain |
| A WebGL-capable browser | Required for the 3D stage (the rest of the app works without it) |

### 1. Backend

```bash
cd backend
composer install
php bin/console doctrine:migrations:migrate -n
php bin/console app:lessons:import
```

### 2. Frontend

```bash
cd frontend
npm install
```

---

## Getting Started

Start the API on port **8000**:

```bash
cd backend
symfony server:start --port=8000 --no-tls -d
```

Start the Angular development server on port **4200** (it proxies `/api` to `http://127.0.0.1:8000`
through `proxy.conf.json`):

```bash
cd frontend
npm start
```

Open **http://localhost:4200/**. It opens in English (`/en/board`) unless another language was chosen
before; `/fr/board`, `/es/board` and `/ar/board` open the other languages directly.

> **Windows / XAMPP:** use `symfony server:start` (multiple php-cgi workers) rather than `php -S`, which is
> single-threaded and can stall on the development proxy's keep-alive connections.

### Useful commands

| Command | Location | Purpose |
|---|---|---|
| `npm start` | `frontend/` | Development server with live reload |
| `npm run build` | `frontend/` | Production build to `frontend/dist/frontend` |
| `npm run watch` | `frontend/` | Development build in watch mode |
| `php bin/phpunit` | `backend/` | Run the backend test suite |
| `php bin/console app:lessons:import [file]` | `backend/` | Import or refresh lessons (safe to re-run) |
| `php bin/console debug:router` | `backend/` | List the API routes |
| `symfony server:stop` | `backend/` | Stop the local API server |

Quick API check:

```bash
curl http://127.0.0.1:8000/api/health
# {"status":"ok","lessons":16}
```

### Testing

The backend has 11 PHPUnit tests (75 assertions) covering lessons, the localization fallback, validation,
events, XP and achievement rules, reset and the offline tutor. Tests run against their own SQLite database
(`var/test.db`) and force `ANTHROPIC_API_KEY` to be empty, so they never call the paid API.

```bash
cd backend
php bin/phpunit
```

---

## Project Structure

```
ARDUVIA/
├── README.md
├── backend/                              # Symfony 7.3 REST API
│   ├── config/packages/                  # doctrine, nelmio_cors, rate_limiter, lock, validator…
│   ├── data/lessons.json                 # 16 lessons × 4 languages, sketches and challenges
│   ├── migrations/                       # Doctrine migrations
│   ├── public/index.php                  # Front controller
│   ├── src/
│   │   ├── Command/ImportLessonsCommand.php
│   │   ├── Controller/                   # LessonController, LearnerController, AssistantController
│   │   ├── Dto/                          # SettingsInput, ProgressInput, EventInput, AssistantInput
│   │   ├── Entity/                       # Lesson, LessonTranslation, Learner, LessonProgress, ActivityEvent
│   │   ├── EventSubscriber/              # ApiExceptionSubscriber (JSON errors)
│   │   ├── Repository/                   # Doctrine repositories
│   │   └── Service/                      # LessonImporter, LessonPresenter, ProgressTracker,
│   │                                     # Gamification, LearningAssistant, LocalTutor
│   └── tests/                            # Api/ (functional) and Unit/ tests
└── frontend/                             # Angular 20 application
    ├── proxy.conf.json                   # /api → http://127.0.0.1:8000
    ├── public/favicon.svg
    └── src/
        ├── index.html                    # Metadata, fonts
        ├── styles.scss                   # Style entry point
        ├── styles/                       # _tokens, _base, _chrome, _stage, _panels, _lessons, _layout, _premium
        └── app/
            ├── app.ts                    # Shell: artboard scaling, routing, loader, shortcuts
            ├── app.routes.ts             # Localized routes (/:lang/:slug)
            ├── core/                     # services, models, i18n, challenges, gamification
            │   └── sim/                  # interpreter.ts (with debugger), sim.service.ts
            ├── scene/                    # engine.ts, benches.ts, board.ts, kit.ts (three.js)
            └── ui/                       # sidebar, header, stage, info-card, code-card, lesson-strip,
                                          # assistant-panel, dashboard, celebrations, motion, markdown,
                                          # icon, editor/completions
```

---

## Configuration

### Backend environment

Symfony reads `backend/.env`, which can be overridden in `backend/.env.local` (not committed).

| Variable | Default | Description |
|---|---|---|
| `APP_ENV` | `dev` | `dev` or `prod`. The local `.env.local` currently sets `prod` for speed |
| `APP_DEBUG` | — | Set to `0` to disable debug mode |
| `APP_SECRET` | placeholder value | **Replace with your own secret for any real deployment** |
| `DATABASE_URL` | `sqlite:///%kernel.project_dir%/var/data.db` | Doctrine connection string |
| `CORS_ALLOW_ORIGIN` | `^https?://(localhost\|127\.0\.0\.1)(:[0-9]+)?$` | Allowed origins (regular expression) |
| `ANTHROPIC_API_KEY` | *(unset)* | Enables the Claude-powered tutor; without it the offline tutor answers |

Other settings:

- **Assistant rate limit:** `config/packages/rate_limiter.yaml` (sliding window, 20 questions per 10 minutes
  per learner).
- **Changing `APP_ENV`:** after switching to `prod`, rebuild the cache while the server is stopped:
  `php bin/console cache:clear --env=prod`. In `prod` mode MakerBundle is unavailable, so run
  `make:migration` with `APP_ENV=dev`.
- **Lesson content:** all lesson text, challenges and sketches live in `backend/data/lessons.json`. Edit
  the file, then run `php bin/console app:lessons:import`.

### Frontend

| Setting | Location |
|---|---|
| API proxy | `frontend/proxy.conf.json` |
| Bundle budgets (warning 1.5 MB, error 3 MB) | `frontend/angular.json` |
| Languages, default locale and RTL locales | `frontend/src/app/core/i18n.ts` (`LOCALES`, `DEFAULT_LOCALE`, `RTL_LOCALES`) |
| Challenge verification rules | `frontend/src/app/core/challenge.service.ts` |
| Autocomplete dictionary | `frontend/src/app/ui/editor/completions.ts` |
| Design tokens (palette, fonts) | `frontend/src/styles/_tokens.scss` |

---

## Screenshots & Preview

No screenshots are included in the repository yet. To add them, store images in a `docs/screenshots/`
folder and reference them here, for example:

```markdown
![Lesson workbench (desktop)](docs/screenshots/desktop.png)
```

Suggested views: a lesson with a running sketch and the serial monitor, a solved challenge, the learning
dashboard, the AI tutor, the debugger paused on a breakpoint, and the Arabic right-to-left layout on mobile.

---

## Video Presentation

A video presentation is not available yet. Add a link here once one is recorded.

---

## Performance & Optimization

- **Production bundle:** about **1.14 MB raw / 276 kB transferred** for the initial load.
- **Rendering outside Angular:** the three.js loop runs outside `NgZone`; labels, wire chips and readouts
  are positioned by direct DOM updates, so no change detection runs per frame.
- **Signals and `OnPush`** on every component.
- **Shared GPU resources:** canvas textures, toon materials and outline geometries are created once and
  reused. Geometries are disposed when the lesson changes.
- **Bounded rendering cost:** the pixel ratio is capped, frame work pauses in hidden tabs, the minimap
  redraws every sixth frame, and lesson thumbnails are drawn once by a single offscreen renderer.
- **Network:** lesson responses carry `Cache-Control: public, max-age=60`. Lesson details are cached in
  memory, and only the neighbouring lessons are prefetched. The catalogue and the current lesson load in
  parallel, and stale responses are discarded. Fonts load without blocking rendering.
- **Responsive interpreter:** long-running sketches periodically yield to the event loop; the debugger pauses
  between statements without blocking the UI.
- **Cheap analytics:** gamification is computed in a single chronological pass over a learner's events.

---

## Responsive Design

| Context | Layout |
|---|---|
| **Desktop and landscape tablets** | A 941 px-tall artboard scaled to the viewport (minimum logical width 1180 px). Wider screens get a wider 3D stage. |
| **Phones and portrait tablets** (≤ 760 px wide, or portrait under 900 px) | A single stacked column, a fixed bottom tab bar, menus as bottom sheets, and the AI tutor as a full-height sheet. |
| **Phones in landscape** (height ≤ 500 px) | Two columns: a sticky 3D stage and scrollable panels, with a side rail. |
| **Right-to-left (Arabic)** | Every layout above is mirrored with CSS logical properties; code, serial output and 3D labels stay left-to-right. |

The dashboard reflows to two columns on small screens. Safe-area insets are respected
(`viewport-fit=cover`), and the 3D stage supports pinch-to-zoom and touch panning.

---

## Security

- **No passwords or personal data:** learners are anonymous and identified only by a random UUID v4 token.
- **Strict routing:** route requirements constrain tokens (UUID pattern) and slugs (`[a-z0-9-]+`).
- **Input validation:** request bodies are mapped to DTOs with `#[MapRequestPayload]` and validated with
  Symfony constraints (allowed locales, event types and assistant modes, lengths). Invalid input returns
  **422** with field-level violations.
- **Safe error handling:** `ApiExceptionSubscriber` returns JSON errors and hides internal details for 5xx
  responses.
- **Database access:** Doctrine query builder with bound parameters.
- **AI assistant:** the API key stays on the server; questions are rate-limited per learner; inputs are
  length-limited; learner code, errors and serial output are passed to the model as delimited data, never as
  instructions. Assistant answers are rendered with an escaping Markdown renderer and Angular's sanitizer.
- **Sandboxed code execution:** learner sketches run in a purpose-built interpreter, never through `eval`,
  with no access to the network, the DOM or storage.
- **CORS:** restricted by a configurable origin regex (localhost by default).
- **Test isolation:** the test suite cannot reach the paid API.

> ⚠️ **Before deploying publicly:** set a strong `APP_SECRET`, configure `CORS_ALLOW_ORIGIN` for your
> domain, serve over HTTPS, and consider rate limiting `POST /api/learners`. Tokens are bearer identifiers:
> anyone holding a token can read and change that learner's progress.

---

## Future Improvements

- Frontend unit tests for the interpreter, the challenge checks and the editor (Angular's Jasmine/Karma
  tooling is installed, but no frontend specs exist yet).
- Server-side refusal fallbacks for the Claude tutor; today a declined request falls back to the offline tutor.
- Optional user accounts to sync progress across devices.
- A Docker / docker-compose setup with PHP-FPM and Nginx for production-like deployments.
- Wider interpreter coverage (`switch`, `String` methods, `Serial` input, more libraries).
- Additional languages; the content model and the `LOCALES` lists make adding one straightforward.
- Screenshots and a video walkthrough in this README.

---

## Author

**Dhia Saied**

---

## License

This repository does not include a license file. The backend's `composer.json` declares the package as
`proprietary`, so all rights are reserved by the author unless a license is added. To open-source the
project, add a `LICENSE` file (for example MIT) and update this section.

# Dossier.ai - GitHub Profile Intelligence Dashboard

> Turn any GitHub profile into a full developer intelligence report, powered by Google Gemini AI. No backend. No server. Just open it and go.

![HTML](https://img.shields.io/badge/Built%20With-HTML%20%2F%20CSS%20%2F%20JS-orange?style=flat-square)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-blue?style=flat-square)
![API](https://img.shields.io/badge/Data-GitHub%20REST%20API-black?style=flat-square)
![Deploy](https://img.shields.io/badge/Deployed%20on-GitHub%20Pages-brightgreen?style=flat-square)

---

## Live Demo

**[View Dossier.ai on GitHub Pages](https://dipjyoti-karmakar.github.io/dossair.ai)**

---

## Overview

Flux is a single-page personal finance dashboard built with **HTML, CSS, and vanilla JavaScript**. It uses **Firebase Authentication** (Google sign-in) and **Cloud Firestore** for real-time data sync across devices - no backend code, no build step, no framework.

The entire application ships as one `index.html` file (~3,100 lines) with embedded styles and ES-module scripts. It is installable as a **Progressive Web App** and works offline.

---

## Features

### Core Functionality

| Capability | Details |
|---|---|
| **Transaction CRUD** | Add, edit, delete income/expense records with 5-second undo on delete - category, payment mode, date, and description |
| **Real-time Cloud Sync** | Firestore `onSnapshot` listeners with debounced rendering (120 ms) and tri-state sync indicator |
| **Excel / CSV Import** | File-picker import with auto column-mapping, row validation, duplicate detection, and 450-op batch writes |
| **CSV Export** | One-click export of complete transaction history |
| **Special Events** | Named events with date ranges and colour tags - link transactions to track event-level spending |

### Analytics Dashboard

| Section | What it shows |
|---|---|
| **Summary Cards** | Net balance, total income/expenses, avg spend per day, active days, online vs. offline spend |
| **Stats Modes** | Toggle This Month / This Year / All Time / Custom Date Range across every summary widget |
| **Expense Trend** | Canvas line chart with Expense / Income / Both toggle, gradient fill, grid lines, crosshair hover, edge-clamped tooltips, theme-aware colours, and screen-reader aria-label summary |
| **Category Breakdown** | Proportional bar + tag-card detail view by expense category |
| **Online vs. Offline Split** | Percentage bar and side-by-side comparison cards with avg/day |
| **Yearly Overview** | Collapsible year blocks → month cards with sparkline bars, today callout, progress %, and lazy-loaded TX lists |
| **Monthly Insights** | Auto-generated text comparing current vs previous month - savings diff, spending % change, top category, per-category swings, exceeded-category count |

### UI Polish & Micro-interactions

| Enhancement | Details |
|---|---|
| **Animated Number Counters** | All stat values count up smoothly with ease-out cubic animation on each render |
| **Balance Health Glow** | Net Balance card pulses green / red / amber based on financial health |
| **Add TX Flash** | Submit button shows "✓ Added" with a green flash; new transaction highlights with a gold inset glow |
| **Mobile FAB** | Floating "+" button on ≤ 520 px screens, auto-hides when the form is in viewport |
| **Skeleton Loading** | Shimmer placeholders in transactions, trend chart, categories, and split view while Firestore data loads |
| **Staggered Entrances** | Summary cards and below-grid sections fade-slide in with staggered delays on page load |
| **Scroll-to-Top** | Fixed button appears after 400 px scroll, smooth-scrolls to top (bottom-left, clear of the FAB) |
| **Illustrated Empty States** | Every no-data view shows a floating animated icon, title, and descriptive subtitle instead of plain text |
| **Theme Wipe Animation** | Toggling dark/light triggers a circular clip-path wipe that expands from the toggle button position |
| **Swipe-to-Action** | On touch devices, swipe a transaction left to reveal Delete or right to reveal Edit - follows finger with spring physics |
| **Milestone Confetti** | Canvas-based confetti burst on transaction milestones (1st, 10th, 25th, every 50th) with themed particle colours |
| **Parallax Summary Cards** | Subtle scroll-driven translateY parallax on summary cards (desktop only, uses CSS custom properties to coexist with hover) |
| **Description Autocomplete** | Custom dropdown on the description input suggests past transaction descriptions, with keyboard navigation and click selection |

### UX & Accessibility

- **Dark / Light theme** - persisted in `localStorage`, toggles all CSS custom properties with a circular wipe animation expanding from the toggle button
- **Responsive layout** - CSS Grid with breakpoints at 960 px, 768 px, and 520 px; bottom-sheet modals on mobile
- **Transaction search** - real-time text filter across descriptions
- **Advanced filters** - date range (today / month / all / custom), type (income / expense / online / offline), and event-based filtering with totals bar
- **Keyboard navigation** - Escape closes modals in z-order priority; Tab / Shift+Tab focus-traps inside active modals
- **ARIA labels** - all icon-only buttons carry descriptive `aria-label` attributes; trend chart canvas has a dynamic screen-reader summary of trend direction and totals
- **Pagination** - lazy "Load More" with configurable page sizes per filter context

### Robustness

- **Input validation** - descriptions, amounts (> 0), and dates validated before writes; invalid fields shake with visual feedback
- **Granular error handling** - Firebase errors (`resource-exhausted`, `unavailable`, `permission-denied`) surface specific user-facing messages with row counts
- **Debounced render** - coalesces rapid Firestore snapshot fires (e.g. batch imports) into a single 120 ms render cycle
- **Events fallback** - if Firestore rules block a dedicated `events` collection, the app automatically falls back to the `transactions` collection
- **AbortController cleanup** - chart event listeners are properly aborted and re-attached on every re-render to prevent stale handlers

### Progressive Web App (PWA)

| Feature | Details |
|---|---|
| **Installable** | `manifest.json` with app name, theme colour, standalone display - "Add to Home Screen" from browser |
| **Service Worker** | `sw.js` caches HTML + CDN assets; network-first for navigation, cache-first for static resources |
| **Firestore Offline Persistence** | `enableIndexedDbPersistence` stores data in IndexedDB; reads/writes work offline and sync when back online |
| **Install Prompt** | In-app banner with `beforeinstallprompt` handling; auto-dismisses after install |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Markup & Styling** | HTML5, CSS3 - custom properties, Grid, `color-mix()`, media queries, keyframe animations |
| **Logic** | Vanilla JavaScript (ES modules, `requestAnimationFrame`, `IntersectionObserver`-style scroll) |
| **Authentication** | Firebase Auth v11.6 - Google sign-in via popup |
| **Database** | Cloud Firestore - real-time `onSnapshot` listeners, `writeBatch` for bulk ops, IndexedDB offline persistence |
| **Charting** | Canvas 2D API - fully custom-drawn trend chart (no library) |
| **Import Engine** | SheetJS (xlsx) v0.18.5 - loaded via CDN |
| **PWA** | Service Worker + Web App Manifest - installable, works offline |
| **Fonts** | Google Fonts - Playfair Display, DM Mono, DM Sans |

---

## Data Model

```
users/
  {uid}/
    transactions/             # one doc per transaction
      {txId}
        ├── type       string   "income" | "expense"
        ├── mode       string   "online" | "offline"
        ├── desc       string   description (max 50 chars)
        ├── cat        string   food | transport | salary | …
        ├── amount     number   > 0
        ├── date       string   "YYYY-MM-DD"
        ├── eventId    string   (optional) linked event ID
        └── _imp       boolean  (optional) true if imported via file

    events/                   # one doc per special event
      {eventId}
        ├── name       string   event name (max 60 chars)
        ├── start      string   "YYYY-MM-DD"
        ├── end        string   "YYYY-MM-DD"
        ├── color      string   hex colour code
        └── createdAt  number   epoch ms
```

---

## How to get the code

```bash
# Clone the repository (HTTPS)
git clone https://github.com/Dipjyoti-Karmakar/flux-personal-finance-dashboard.git

# Or using SSH
git clone git@github.com:Dipjyoti-Karmakar/flux-personal-finance-dashboard.git
```

## Getting Started

### 2. Run

Open `index.html` directly in a browser, or serve it locally:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Visit `http://localhost:8000`.

### 3. Firebase Configuration (optional)

The app ships with a default Firebase project. To use your own:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Google Authentication** and **Cloud Firestore**
3. Replace the `firebaseConfig` object inside `index.html` with your project's credentials

---

## Project Structure

```
flux-webapp/
├── index.html       # Entire application - HTML + CSS + JS (single-file architecture)
├── manifest.json    # PWA Web App Manifest (name, icons, theme, display mode)
├── sw.js            # Service Worker (offline caching, asset pre-cache)
└── README.md        # This file
```

No build tools, no `node_modules`, no transpilation. All styles and scripts are embedded.

> **Note:** For the Service Worker to function, serve the project via HTTP (`localhost` or HTTPS). Opening `index.html` as a `file://` URL will register the app but the SW won't activate.

---

## Browser Support

Tested on the latest versions of **Chrome**, **Edge**, **Firefox**, and **Safari**.  
Requires ES module support (`<script type="module">`).

---

## Author

**Dipjyoti Karmakar**  
Data Analyst · Frontend Developer · Business Intelligence  
[LinkedIn](https://www.linkedin.com/in/dipjyoti-karmakar-91050a37a)

---

<sub>Built as a portfolio project demonstrating vanilla JavaScript application development, Firebase cloud integration, Canvas-based data visualization, micro-interaction design, PWA offline capabilities, and responsive UI engineering.</sub>

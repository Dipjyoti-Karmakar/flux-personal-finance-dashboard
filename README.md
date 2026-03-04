# Flux — Personal Finance Dashboard

![HTML5](https://img.shields.io/badge/HTML5-Frontend-orange?style=for-the-badge&logo=html5)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-yellow?style=for-the-badge&logo=javascript)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-ffca28?style=for-the-badge&logo=firebase)
![Status](https://img.shields.io/badge/Status-Completed-success?style=for-the-badge)

---

## Overview

Flux is a single-page personal finance dashboard built with **HTML, CSS, and vanilla JavaScript**. It uses **Firebase Authentication** (Google sign-in) and **Cloud Firestore** for real-time data persistence, so transactions sync instantly across devices with zero backend code.

The entire application ships as a single `index.html` file — no build step, no framework, no dependencies beyond Firebase and SheetJS.

---

## Features

### Core

| Capability | Details |
|---|---|
| **Transaction CRUD** | Add, edit, and delete income/expense records with category, payment mode, date, and description |
| **Real-time Cloud Sync** | Firestore `onSnapshot` listeners with debounced rendering and loading state indicators |
| **Excel / CSV Import** | Drag-and-drop or file-picker import with automatic column mapping, row validation, duplicate detection, and batch writes (450-op batches) |
| **CSV Export** | One-click export of all transaction history |
| **Special Events** | Create named events (e.g. "Holiday Trip"), assign date ranges, and tag transactions to track event-level spending |

### Analytics Dashboard

| Section | What it shows |
|---|---|
| **Summary Cards** | Net balance, total income, total expenses, average spend per day, active days, online vs. offline spend |
| **Stats Modes** | Toggle between This Month / This Year / All Time across all summary cards |
| **Expense Trend** | Canvas-rendered line chart with gradient fill, grid lines, crosshair hover, and edge-clamped tooltips |
| **Category Breakdown** | Proportional bar and tag-based detail view by expense category |
| **Online vs. Offline Split** | Percentage bar and comparison cards |
| **Yearly Overview** | Collapsible year blocks with month cards, sparkline bars, today callout, progress indicators, and lazy-loaded transaction lists |

### UX & Accessibility

- **Dark / Light theme** — persisted in `localStorage`, instantly toggles all CSS custom properties
- **Responsive layout** — CSS Grid with breakpoints at 960 px, 768 px, and 520 px; bottom-sheet modals on mobile
- **Transaction search** — real-time text filter across descriptions
- **Advanced filters** — date range (today / month / all / custom), type (income / expense / online / offline), and event-based filtering with totals bar
- **Keyboard support** — Escape closes modals in z-order priority; Tab/Shift+Tab focus-traps inside active modals
- **ARIA labels** — all icon-only buttons carry descriptive `aria-label` attributes
- **Pagination** — lazy "Load More" with configurable page sizes per filter context

### Robustness

- **Input validation** — descriptions, amounts (must be > 0), and dates are validated before writes; invalid fields shake with visual feedback
- **Granular error handling** — Firebase errors (`resource-exhausted`, `unavailable`, `permission-denied`) surface specific user-facing messages with row counts during import
- **Debounced render** — coalesces rapid Firestore snapshot fires (e.g. during batch imports) with a 120 ms timer
- **Events fallback** — if Firestore rules block a dedicated `events` collection, the app automatically falls back to storing events inside the `transactions` collection

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Markup & Styling** | HTML5, CSS3 (custom properties, Grid, media queries, `color-mix()`) |
| **Logic** | Vanilla JavaScript (ES modules) |
| **Authentication** | Firebase Auth v11 — Google sign-in |
| **Database** | Cloud Firestore — real-time listeners, batch writes |
| **Charting** | Canvas 2D API (custom-drawn, no chart library) |
| **Import Engine** | SheetJS (xlsx) v0.18 — loaded via CDN |

---

## Data Model

```
users/
  {uid}/
    transactions/        # one document per transaction
      {txId}
        ├── type         string   "income" | "expense"
        ├── mode         string   "online" | "offline"
        ├── desc         string   description (max 50 chars)
        ├── category     string   food | transport | salary | …
        ├── amount       number   > 0
        ├── date         string   "YYYY-MM-DD"
        ├── eventId      string   (optional) linked event ID
        └── _imp         boolean  (optional) imported via file

    events/              # one document per special event
      {eventId}
        ├── name         string   event name
        ├── start        string   "YYYY-MM-DD"
        ├── end          string   "YYYY-MM-DD"
        ├── color        string   hex colour
        └── createdAt    number   epoch ms
```

---

## Getting Started

### 1. Clone

```bash
git clone https://github.com/yourusername/flux-webapp.git
cd flux-webapp
```

### 2. Run

Open `index.html` directly in a browser, or serve it locally:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then visit `http://localhost:8000`.

### 3. Firebase Configuration (optional)

The app ships with a default Firebase project. To use your own:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Google Authentication** and **Cloud Firestore**
3. Replace the `firebaseConfig` object inside `index.html` with your project credentials

---

## Project Structure

```
flux-webapp/
├── index.html          # Entire application (HTML + CSS + JS)
└── README.md           # This file
```

Single-file architecture — all styles and scripts are embedded. No build tools, no `node_modules`, no transpilation.

---

## Browser Support

Tested on the latest versions of Chrome, Edge, Firefox, and Safari. Requires ES module support (`<script type="module">`).

---

## Author

**Dipjyoti Karmakar**
- Data Analyst · Frontend Developer · Business Intelligence
- [LinkedIn](https://www.linkedin.com/in/dipjyoti-karmakar-91050a37a)

---

<sub>Built as a portfolio project demonstrating vanilla JavaScript application development, Firebase cloud integration, Canvas-based data visualization, and responsive UI engineering.</sub>

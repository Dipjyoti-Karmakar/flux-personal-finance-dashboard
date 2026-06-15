# Flux: Personal Finance Dashboard

> A single-file personal finance dashboard built with vanilla JavaScript, Firebase Firestore, and a PWA-first architecture. No build tools. No frameworks. No backend.

![HTML5](https://img.shields.io/badge/HTML5-Frontend-orange?style=for-the-badge&logo=html5)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-yellow?style=for-the-badge&logo=javascript)
![Firebase](https://img.shields.io/badge/Firebase-v11.6.1-ffca28?style=for-the-badge&logo=firebase)
![PWA](https://img.shields.io/badge/PWA-Offline--First-5a67d8?style=for-the-badge&logo=googlechrome)
![Status](https://img.shields.io/badge/Status-Completed-success?style=for-the-badge)

---

## Live Demo

**[View Flux on GitHub Pages](https://dipjyoti-karmakar.github.io/flux-personal-finance-dashboard/)**

---

## Overview

Flux is a **6,300+ line single-file web application**, with all HTML, CSS, and JavaScript in one `index.html`. It uses **Firebase Auth v11.6.1** (Google sign-in popup) and **Cloud Firestore** with persistent local cache for real-time sync across devices and full offline support.

The app is Indian-locale-first: all amounts are formatted in **INR (₹)** using `en-IN` locale conventions. There are no build steps, no `node_modules`, and no framework dependencies.

---

## Features

### Transaction Management

| Capability | Details |
| --- | --- |
| **CRUD** | Add, edit, and delete income or expense transactions with category, payment mode (online/offline), date, and description |
| **Delete with Undo** | Deletion shows a confirmation dialog first, then a 5-second undo window via a toast snackbar before the write is committed |
| **Payment Modes** | Every transaction is tagged as `online` or `offline`, feeding the Online vs Offline split analytics |
| **Input Validation** | Descriptions, amounts, and dates are validated before any write. Invalid fields shake with a visual animation |
| **Description Autocomplete** | A custom dropdown on the description field suggests past transaction descriptions with keyboard and click navigation |
| **Transaction Search** | Real-time text filter across all descriptions |
| **Advanced Filters** | Filter by date range (today, this month, this year, custom, all-time), type, payment mode, event, or subscription. Active filters show a totals bar |
| **Pagination** | Lazy "Load More" with configurable page sizes per filter context |

### Categories

**Expense:** Food, Transport, Housing, Entertainment, Health, Shopping, Utilities, Occasions, Stationery, Other

**Income:** Salary, Freelance, Investment, Other

### Recurring Subscriptions

| Capability | Details |
| --- | --- |
| **Frequencies** | Monthly, weekly, yearly, daily, or custom day intervals |
| **Auto-generation** | On login, Flux checks all subscriptions with a past `nextDue` date and auto-creates the corresponding transactions, then advances `nextDue` |
| **Pause / Resume** | Each subscription can be individually paused and resumed without deletion |
| **Visual Tags** | Auto-generated transactions carry a subscription badge in the list |
| **Monthly + Yearly Cost Summary** | A footer row totals your projected monthly and annual recurring spend |

### PDF Reports

PDF generation uses **jsPDF 2.5.1 + jspdf-autotable 3.8.2**, with **pdfmake 0.2.7** injected purely to supply the Roboto font, enabling correct Unicode ₹ rendering in the PDF output.

| Report Period | Coverage |
| --- | --- |
| **Month** | Single calendar month with year selector |
| **Year** | Full calendar year summary |
| **Custom** | Any arbitrary date range |
| **Event** | All transactions linked to a named special event |

Each report is A4 portrait and includes configurable sections: income transactions, expense transactions, category breakdown, and full transaction list. The report also auto-generates text insights including savings rate, average daily spend, largest transaction, top spending category, and online vs offline split.

### Special Events

Named events with start/end dates and custom hex colour codes. Transactions can be linked to an event at creation or via a bulk-apply tool that tags all matching transactions in a date range. Events can also be bulk-unlinked. Linked transactions show a coloured event badge in the list.

### Cloud-Synced Activity Log

Every ADD, EDIT, DELETE, UPDATE, and IMPORT action is written as an entry to the `activities` Firestore subcollection. The log auto-prunes to **300 entries**, deleting the oldest documents in batches of 499 when the limit is exceeded. The log is clearable from the UI with a matching undo snackbar.

### Analytics Dashboard

| Section | Details |
| --- | --- |
| **Stats Modes** | Toggle between This Month, This Year, All Time, and Custom Date Range across every analytics widget |
| **Summary Cards** | Net balance (with health glow), total income, total expenses, average spend per day, active days count, and online vs offline expense totals |
| **Animated Counters** | All stat values count up with an ease-out cubic animation on each render |
| **Expense Trend Chart** | Canvas 2D line chart with Expense / Income / Both toggle, gradient fill, grid lines, crosshair hover, and edge-clamped tooltips |
| **Category Breakdown** | Proportional bar visualization with clickable category cards that expand to show paginated transaction lists |
| **Online vs Offline Split** | Percentage bar, side-by-side comparison cards with per-day averages |
| **Yearly Overview** | Collapsible year blocks with month cards, sparkline bars, a today callout, progress percentage, and lazy-loaded transaction lists |
| **Monthly Insights** | Auto-generated text comparing the current vs previous month: savings diff, spending % change, top category, per-category swings, exceeded-budget category count |

### Excel / CSV Import

The import engine uses **SheetJS (xlsx 0.18.5)** for file parsing. It handles auto column-mapping, row validation, duplicate detection, and writes in batched Firestore commits of **450 operations per batch** to stay safely under Firestore's 500-write limit.

### Offline Resilience

Flux uses two independent offline layers:

1. **Firestore `persistentLocalCache()`**: all reads and writes work against IndexedDB when offline and sync automatically when connectivity returns.
2. **Failed-write queue**: if a Firestore write throws while online (e.g. a transient error), the operation is serialised to `localStorage` under the key `flux_sync_queue` and replayed the next time the app detects a network connection.

### UI and Micro-interactions

| Enhancement | Details |
| --- | --- |
| **Theme Wipe Animation** | Dark/light toggle triggers a circular clip-path wipe expanding from the exact position of the toggle button |
| **Balance Health Glow** | The Net Balance card pulses green, red, or amber based on whether the balance is positive, negative, or zero |
| **Add TX Flash** | The submit button shows a "✓ Added" confirmation with a green flash; the new transaction row highlights with a gold glow |
| **Swipe-to-Action** | On touch devices, swipe left to reveal Delete, right to reveal Edit, with spring physics following the finger |
| **Milestone Confetti** | Canvas-based confetti fires on the 1st, 10th, 25th transaction, then every 50th |
| **Skeleton Loading** | Shimmer placeholders fill the transaction list, trend chart, categories, and split view while Firestore data loads |
| **Staggered Entrances** | Summary cards and below-grid sections fade and slide in with staggered delays on page load |
| **Parallax Summary Cards** | Subtle scroll-driven `translateY` parallax on summary cards (desktop only, coexists with hover via CSS custom properties) |
| **Mobile FAB** | Floating "+" button on screens 520px and narrower, auto-hides when the add form is already in the viewport |
| **Scroll-to-Top** | Fixed button appears after 400px scroll, positioned bottom-left to avoid the FAB |
| **Illustrated Empty States** | Every no-data view shows a floating animated icon, title, and descriptive subtitle |
| **Twemoji** | Emoji in category labels and activity log entries are rendered via Twemoji for consistent cross-platform display |

### PWA

| Feature | Details |
| --- | --- |
| **Installable** | `manifest.json` with standalone display, theme colour, and icon sets for both Android and iOS |
| **Service Worker** | `sw.js` (cache version `flux-v24`) uses network-first for navigation, cache-first for static assets, and skips Firebase/Firestore URLs so Firestore offline persistence manages its own cache |
| **iOS Support** | `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` meta tags for home screen install behaviour |
| **Install Prompt** | In-app snackbar via `beforeinstallprompt` with Install and Dismiss controls |

### Security

- **Content Security Policy**: a strict CSP meta tag restricts script, style, font, image, connect, frame, and worker sources to an explicit allowlist
- **Subresource Integrity**: the SheetJS CDN script carries an `integrity="sha384-..."` attribute
- **Firestore Security Rules**: all data is locked behind ownership checks (see the setup section below); the schema is enforced at the rule level with required field and type validation

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Markup and Styling** | HTML5, CSS3 custom properties, Grid, media queries, keyframe animations |
| **Logic** | Vanilla JavaScript ES2020, ES modules |
| **Authentication** | Firebase Auth v11.6.1, Google sign-in popup via `GoogleAuthProvider` |
| **Database** | Cloud Firestore v11.6.1, `persistentLocalCache()`, real-time `onSnapshot` listeners, batched writes |
| **Charting** | Canvas 2D API, custom-built trend chart, confetti engine |
| **PDF Generation** | jsPDF 2.5.1 + jspdf-autotable 3.8.2 + pdfmake 0.2.7 (Roboto font for Unicode ₹) |
| **Spreadsheet Import** | SheetJS xlsx 0.18.5 via CDN with SRI |
| **Emoji Rendering** | Twemoji (unpkg CDN) |
| **Fonts** | Google Fonts: Playfair Display, DM Mono, DM Sans |
| **PWA** | Service Worker (`flux-v24`) + Web App Manifest |

---

## Data Model

```
users/
  {uid}/
    transactions/             # one doc per transaction
      {txId}
        type        string    "income" | "expense"
        mode        string    "online" | "offline"
        desc        string    description (max 50 chars)
        cat         string    expense: food | transport | housing | entertainment |
                              health | shopping | utilities | occasions | stationery | other
                              income: salary | freelance | investment | other
        amount      number    > 0
        date        string    "YYYY-MM-DD"
        createdAt   number    epoch ms
        eventId     string    (optional) linked event ID
        _imp        boolean   (optional) true if imported via file
        _recurring  boolean   (optional) true if auto-generated by subscription

    events/                   # one doc per special event
      {eventId}
        name        string    event name (max 60 chars)
        start       string    "YYYY-MM-DD"
        end         string    "YYYY-MM-DD"
        color       string    hex colour code
        createdAt   number    epoch ms

    recurring/                # one doc per subscription
      {recId}
        name        string    subscription name
        amount      number    > 0
        cat         string    category
        type        string    "income" | "expense"
        mode        string    "online" | "offline"
        freq        string    "monthly" | "weekly" | "yearly" | "daily" | "custom"
        customDays  number    (optional) custom days interval
        nextDue     string    "YYYY-MM-DD"
        active      boolean   false = paused

    activities/               # one doc per activity log entry (auto-pruned to 300)
      {activityId}
        a           string    "ADD" | "EDIT" | "DELETE" | "UPDATE" | "IMPORT"
        m           string    formatted message / diff
        ts          number    epoch ms
        tp          string    (optional) transaction type for icon colouring
```

---

## Setting Up Your Own Firebase Project

The app ships with a default Firebase project so it works out of the box. To connect your own project, follow these steps.

### Step 1: Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**
2. Give it a name, then follow the prompts (you can disable Google Analytics if you prefer)

### Step 2: Enable Google Authentication

1. In the Firebase console, go to **Build > Authentication**
2. Click **Get started**, then select the **Sign-in method** tab
3. Enable **Google** as a sign-in provider and save

### Step 3: Create a Firestore Database

1. Go to **Build > Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (you will add rules in the next step)
4. Select a region close to your users and click **Enable**

### Step 4: Apply Security Rules

In the Firestore console, go to the **Rules** tab and replace the contents with the following:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    // Protect the root user document
    match /users/{userId} {
      allow read, write: if isOwner(userId);
      // Transactions Collection
      match /transactions/{txId} {
        allow read, delete: if isOwner(userId);
        allow create, update: if isOwner(userId)
          && request.resource.data.keys().hasAll(['desc', 'amount', 'type', 'date', 'createdAt'])
          && request.resource.data.amount is number
          && request.resource.data.desc is string
          && request.resource.data.type in ['income', 'expense'];
      }
      // Subscriptions (Recurring) Collection
      match /recurring/{recId} {
        allow read, delete: if isOwner(userId);
        allow create, update: if isOwner(userId)
          && request.resource.data.keys().hasAll(['name', 'amount', 'freq', 'type', 'createdAt'])
          && request.resource.data.amount is number
          && request.resource.data.name is string
          && request.resource.data.type in ['income', 'expense']
          && request.resource.data.freq in ['daily', 'weekly', 'monthly', 'yearly', 'custom'];
      }
      // Events Collection
      match /events/{evtId} {
        allow read, delete: if isOwner(userId);
        allow create, update: if isOwner(userId)
          && request.resource.data.keys().hasAll(['name', 'start', 'end', 'color'])
          && request.resource.data.name is string;
      }
      // Activity Logs Collection
      match /activities/{actId} {
        allow read, delete: if isOwner(userId);
        allow create, update: if isOwner(userId)
          && request.resource.data.keys().hasAll(['a', 'm', 'ts'])
          && request.resource.data.a in ['ADD', 'EDIT', 'DELETE', 'UPDATE', 'IMPORT']
          && request.resource.data.ts is number;
      }
    }
  }
}
```

Click **Publish**. These rules lock every collection to its owner. No other authenticated user can read or write your data, and the schema is validated at the rule level for every write.

### Step 5: Register a Web App and Get Your Config

1. In the Firebase console, go to **Project settings** (the gear icon)
2. Under **Your apps**, click the **Web** icon (`</>`)
3. Register a name for the app (e.g. "Flux") and click **Register app**
4. Copy the `firebaseConfig` object that appears

### Step 6: Add an Authorised Domain

1. Still in **Project settings**, go to **Authentication > Settings > Authorised domains**
2. Add your GitHub Pages domain (e.g. `your-username.github.io`) so the Google sign-in popup is allowed

### Step 7: Replace the Config in index.html

Open `index.html` and find the `firebaseConfig` object near line 2004. Replace the entire object with your own credentials:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Save the file. The app now reads and writes to your own Firestore database.

---

## Getting the Code

```bash
# Clone via HTTPS
git clone https://github.com/Dipjyoti-Karmakar/flux-personal-finance-dashboard.git

# Or SSH
git clone git@github.com:Dipjyoti-Karmakar/flux-personal-finance-dashboard.git
```

### Running Locally

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then open `http://localhost:8000`.

> The Service Worker requires HTTP (localhost or HTTPS). Opening `index.html` as a `file://` URL will not activate the SW or trigger the install prompt.

---

## Project Structure

```
flux-webapp/
├── index.html      # Entire application: HTML, CSS, and JS in a single file (~6,300 lines)
├── manifest.json   # PWA Web App Manifest
├── sw.js           # Service Worker: offline caching, network-first for navigation
├── icon-192.png    # PWA icon
├── icon-512.png    # PWA icon (also used as Apple touch icon)
└── README.md
```

---

## Browser Support

Tested on the latest versions of Chrome, Edge, Firefox, and Safari.
Requires ES module support (`<script type="module">`).

The app targets Indian users by default; all amounts use the `en-IN` locale and the Indian Rupee symbol (₹).

---

## Author

**Dipjyoti Karmakar**
Data Analyst · Vanilla JS Developer · Business Intelligence
[LinkedIn](https://www.linkedin.com/in/dipjyoti-karmakar-91050a37a) · [GitHub](https://github.com/Dipjyoti-Karmakar)

---

*Built as a portfolio project demonstrating vanilla JavaScript application architecture, Firebase cloud integration, Canvas-based data visualization, micro-interaction design, PWA offline capabilities, and responsive UI engineering, without a single dependency on a JavaScript framework.*

<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# Flux: Personal Finance Dashboard

> A comprehensive personal finance dashboard built with vanilla JavaScript, Firebase, and a PWA-first architecture. No build tools. No frameworks. No backend.

![HTML5](https://img.shields.io/badge/HTML5-Frontend-orange?style=for-the-badge&logo=html5)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-yellow?style=for-the-badge&logo=javascript)
![Firebase](https://img.shields.io/badge/Firebase-v11.6.1-ffca28?style=for-the-badge&logo=firebase)
![PWA](https://img.shields.io/badge/PWA-Offline--First-5a67d8?style=for-the-badge&logo=googlechrome)
![Status](https://img.shields.io/badge/Status-Completed-success?style=for-the-badge)

**[Live Demo on GitHub Pages](https://dipjyoti-karmakar.github.io/flux-personal-finance-dashboard/)**

</div>

---

## Overview

Flux is a production-grade personal finance application built with clean, modular vanilla web technologies, pairing a streamlined `index.html` (~10,600 lines) with a dedicated stylesheet (`style.css`). It leverages **Firebase Authentication** and **Cloud Firestore** for secure, real-time data synchronization. Built with an offline-first PWA architecture, it guarantees full functionality with or without an active internet connection.

The application is localized for India (`en-IN`), formatting all currencies in **INR (₹)**.

---

## Key Features

- **Transaction Management:** Comprehensive CRUD operations for income and expenses with full-text search, category tagging, payment mode filters (Online/Offline/Receipts), and undo action support.
- **Receipt Management:** Serverless Cloudinary-backed receipt storage supporting images and PDFs. Includes interactive image cropping (via Cropper.js), uniform receipt tags throughout the app, an inline modal viewer, and direct file downloads.
- **Subscription Management:** Automated recurring bills with flexible cadences (daily, weekly, monthly, yearly, custom). Features:
  - **Collapsible Filter Box:** Compact full-width trigger on mobile and dedicated header action on desktop.
  - **Multi-Filter Support:** Filter by cadence, type (Expense/Income), due dates (Overdue, Due Today, Due Soon, Month, Exact Date), and search query.
  - **Inline Payment History:** Expandable card panels displaying matched payment logs, totals, and annualized cost projections.
  - **Billing Radar & Lifecycle:** Real-time billing cycle progress bars, early payment detection, pause/resume, and multi-tier pricing support.
- **Event Tracking & Budgets:** Special event grouping for transactions (e.g., vacations, weddings, renovations) with custom date windows, dedicated event filters, and inline budget tracking.
- **Analytics & Yearly Insights:** Interactive Canvas 2D trend charts, dynamic category breakdowns, multi-period filtering, and annual spending summaries.
- **Activity Log & Audit Trail:** Real-time system activity log tracking additions, edits, deletions, updates, and CSV imports with automated log pruning.
- **Reporting & Data Export:** One-click monthly A4 PDF report generation (via jsPDF & jsPDF-AutoTable) and styled Excel exports (`.xlsx` via SheetJS) with clickable receipt links. Bulk CSV transaction import with duplicate checking.
- **Offline Resilience:** Dual-layer offline support combining Firestore's `persistentLocalCache()` with a custom `localStorage` queue that automatically syncs pending writes upon reconnection.
- **Design & UI/UX:** Dark and light themes with smooth glassmorphism, responsive desktop and mobile views (including a dedicated bottom navigation bar on mobile), animated counters, skeleton loaders, and custom 3D emoji iconography.
- **Security:** Hardened with Content Security Policy (CSP), Subresource Integrity (SRI), and comprehensive Firestore security rules.

---

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES2020)
- **Backend & Auth:** Firebase Authentication, Cloud Firestore (v11.6.1)
- **Utilities:** Cropper.js (Receipt image crop), jsPDF & jsPDF-AutoTable (PDF generation), SheetJS (Excel/CSV operations), Cloudinary (Receipt storage)
- **Architecture:** Progressive Web App (PWA) with Service Worker offline caching

---

## Architecture & Data Model

Flux operates without an intermediate application server, interfacing directly with Firebase. Data is partitioned under authenticated users:

```text
users/{uid}/
  ├── transactions/{txId}   # Income/expense records (amount, date, desc, category, receipts, subId, eventId)
  ├── events/{eventId}      # Special events for transaction grouping
  ├── recurring/{recId}     # Automated subscription and recurring bill definitions
  └── activities/{actId}    # System activity log (auto-pruned to 300 entries)
```

*(See `firestore.rules` for exact schema validation and security rules.)*

---

## Local Development & Setup

### 1. Clone & Run

```bash
git clone https://github.com/Dipjyoti-Karmakar/flux-personal-finance-dashboard.git
cd flux-personal-finance-dashboard

# Run via Python or Node.js
python -m http.server 8000
# OR
npx serve .
```

Access the app at `http://localhost:8000`. *(Note: Service Workers require HTTP/HTTPS; `file://` execution is not supported.)*

### 2. Configure Firebase (Optional, for personal instance)

By default, Flux connects to a pre-configured Firebase instance. To connect your own project:

1. Create a project at [Firebase Console](https://console.firebase.google.com).
2. Enable **Google Authentication** (Build > Authentication).
3. Create a **Firestore Database** and deploy the rules from `firestore.rules`.
4. Register a Web App in Project Settings to obtain your `firebaseConfig`.
5. Update the `firebaseConfig` object in `index.html` (around line ~1690).

### 3. Configure Cloudinary for Receipts (Optional)

1. Create a free [Cloudinary](https://cloudinary.com/) account.
2. Under **Settings > Upload**, create a new **Unsigned** upload preset.
3. Update the credentials in `index.html` (around line ~1285):

   ```js
   const CLOUDINARY_CLOUD = 'your_cloud_name';
   const CLOUDINARY_PRESET = 'your_upload_preset';
   ```

---

## Author

**Dipjyoti Karmakar**  
Data Analyst · Vanilla JS Developer · Business Intelligence  
[LinkedIn](https://www.linkedin.com/in/dipjyoti-karmakar-91050a37a) · [GitHub](https://github.com/Dipjyoti-Karmakar)

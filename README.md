<div align="center">

# Flux: Personal Finance Dashboard

> A comprehensive, single-file personal finance dashboard built with vanilla JavaScript, Firebase, and a PWA-first architecture. No build tools. No frameworks. No backend.

![HTML5](https://img.shields.io/badge/HTML5-Frontend-orange?style=for-the-badge&logo=html5)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-yellow?style=for-the-badge&logo=javascript)
![Firebase](https://img.shields.io/badge/Firebase-v11.6.1-ffca28?style=for-the-badge&logo=firebase)
![PWA](https://img.shields.io/badge/PWA-Offline--First-5a67d8?style=for-the-badge&logo=googlechrome)
![Status](https://img.shields.io/badge/Status-Completed-success?style=for-the-badge)

**[Live Demo on GitHub Pages](https://dipjyoti-karmakar.github.io/flux-personal-finance-dashboard/)**

</div>

---

## Overview

Flux is a robust web application housed entirely within a single `index.html` file (~16,000+ lines). It relies on **Firebase Authentication** and **Cloud Firestore** for secure, real-time data synchronization. Built with a PWA-first approach, it offers comprehensive offline support via persistent local caching. 

The application is optimized for the Indian locale (`en-IN`), formatting all currency in **INR (₹)**.

---

## Key Features

- **Transaction Management:** Comprehensive CRUD operations for income and expenses. Includes support for receipt attachments (images/PDFs), online/offline payment tagging, full-text search, and advanced filtering.
- **Receipt Management:** Secure, Cloudinary-backed storage for transaction receipts. Features a dedicated inline viewer and smart, format-aware file downloads.
- **Recurring Subscriptions:** Automates regular expenses with flexible frequencies (daily, weekly, monthly, yearly, custom). Supports pause/resume functionality, alternative price matching, and projected cost analysis.
- **Analytics Dashboard:** Interactive Canvas 2D trend charts, dynamic category breakdowns, and auto-generated monthly spending insights.
- **Reporting & Data Export:** Generate A4 PDF reports (via jsPDF) or export richly formatted `.xlsx` files with clickable receipt hyperlinks. Supports bulk CSV importing with duplicate detection.
- **Offline Resilience:** Dual-layer offline support utilizing Firestore's `persistentLocalCache()` and a custom `localStorage` queue for failed writes during transient network drops.
- **Polished UI/UX:** Features responsive design, swipe-to-action gestures, animated counters, skeleton loading states, and custom 3D emoji iconography.
- **Security:** Hardened with a strict Content Security Policy (CSP), Subresource Integrity (SRI), and comprehensive Firestore security rules for strict data access control.

---

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES2020)
- **Backend & Auth:** Firebase Authentication, Cloud Firestore (v11.6.1)
- **Utilities:** jsPDF & pdfmake (PDF generation), SheetJS (Excel/CSV operations), Cloudinary (Receipt storage)
- **Architecture:** Progressive Web App (PWA) with Service Worker caching

---

## Architecture & Data Model

The application operates without a traditional backend server, interacting directly with Firebase. The Firestore data schema is structured as follows:

```text
users/{uid}/
  ├── transactions/{txId}   # Income/expense records (amount, date, desc, category, receipts)
  ├── events/{eventId}      # Special events for transaction grouping
  ├── recurring/{recId}     # Automated subscription definitions
  └── activities/{actId}    # System activity log (auto-pruned to 300 entries)
```

*(See the `firestore.rules` file for detailed schema validation and access controls.)*

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
Access the app at `http://localhost:8000`. *(Note: The Service Worker requires HTTP/HTTPS; `file://` protocols are not supported.)*

### 2. Configure Firebase (Optional, for independent hosting)
By default, Flux connects to a pre-configured Firebase instance. To use your own backend:
1. Create a project at [Firebase Console](https://console.firebase.google.com).
2. Enable **Google Authentication** (Build > Authentication).
3. Create a **Firestore Database** and apply the security rules found in `firestore.rules`.
4. Register a Web App in Project Settings to obtain your `firebaseConfig`.
5. Replace the existing `firebaseConfig` object in `index.html` (around line 320) with your credentials.

### 3. Configure Cloudinary for Receipts (Optional)
Flux utilizes Cloudinary for serverless receipt storage.
1. Create a free [Cloudinary](https://cloudinary.com/) account.
2. Under **Settings > Upload**, create a new **Unsigned** upload preset.
3. Update `index.html` (around line 7988) with your credentials:
   ```js
   const CLOUDINARY_CLOUD = 'your_cloud_name';
   const CLOUDINARY_PRESET = 'your_upload_preset';
   ```

---

## Author

**Dipjyoti Karmakar**  
Data Analyst · Vanilla JS Developer · Business Intelligence  
[LinkedIn](https://www.linkedin.com/in/dipjyoti-karmakar-91050a37a) · [GitHub](https://github.com/Dipjyoti-Karmakar)

*A portfolio project demonstrating vanilla JavaScript architecture, Firebase integration, Canvas visualization, and offline-first PWA engineering.*

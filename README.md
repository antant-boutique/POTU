# POTU: Product & Order Tracking Unit - Frontend Client

This repository contains the static, responsive frontend client for **POTU: Product & Order Tracking Unit** (Antant Boutique Manager). It is designed to be hosted 100% free on **GitHub Pages** without any credit cards or operational overhead.

---

## 🚀 Key Features

*   **Premium Black & Red Theme**: Harmonious, modern, Outfit-font visual interface designed to impress.
*   **Locked Viewport Layout**: Locked to exactly `100vh` on mobile screen resolutions to eliminate page scrolling.
*   **Responsive Input Forms**: Tables stack dynamically into gorgeous input cards on mobile screen resolutions.
*   **Stage-by-Stage Media Uploads**: Fully pre-configured base64-encoded image pipeline for design stages and catalog products.
*   **Client-Side Fetch Hijacker**: Automatically rewrites all API endpoint queries to target your live remote Render backend url!

---

## 🛠️ Zero-Hassle Deployment Guide

### Step 1: Set Your Live Backend URL
1. Open [index.html](index.html) in your editor.
2. Go to **line 16** inside the `<head>` script block:
   ```javascript
   const RENDER_BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
       ? ''
       : 'https://YOUR-LIVE-BACKEND.onrender.com'; // <-- REPLACE THIS WITH YOUR LIVE RENDER URL
   ```
3. Replace the placeholder URL with your actual, live Render backend URL and save the file.

### Step 2: Push to GitHub & Enable Pages
1. Create a new **public** repository on GitHub.
2. Drag and drop all the contents of this folder (`index.html`, `static/`, `LICENSE`, `README.md`) directly into the repository upload window in your browser.
3. Click **Commit changes**.
4. Go to **Settings > Pages** in your new repository on GitHub:
   *   **Source**: Select **"Deploy from a branch"**.
   *   **Branch**: Select **`main`** (or `master`) and keep the folder as **`/ (root)`**.
   *   Click **Save**.

Your POTU frontend is now live! GitHub will generate a secure URL for you (e.g. `https://username.github.io/repository/`).

---

## 🔒 License
This software and all associated files are proprietary and confidential under an **All Rights Reserved** license. Redistribution, publication, or copying is strictly prohibited. See [LICENSE](LICENSE) for more details.

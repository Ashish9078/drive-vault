# 🌌 DriveVault — Multi-Account Google Drive Storage Aggregator

<div align="center">

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.4-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.3-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css)

**Unify, pool, and manage unlimited Google Drive accounts into a single high-performance virtual storage pool inspired by Windows File Explorer.**

[Key Features](#-key-features) • [Architecture](#-tech-stack) • [Getting Started](#-getting-started) • [API Routes](#-api-routes) • [Security & Encryption](#-security--encryption)

</div>

---

## 📖 Overview

**DriveVault** breaks the single-account quota bottleneck by aggregating multiple Google Drive accounts (15 GB each) into a single unified virtual storage filesystem. 

Files larger than a single account's quota are automatically chunked across multiple accounts and reconstructed on-the-fly during streaming download — with zero manual effort.

---

## ✨ Key Features

### 🪟 Windows "Devices and Drives" Interface
* **Virtual Drive Letters**: Maps each connected Google Drive to a virtual drive letter (`C:`, `D:`, `E:`...) plus a pooled master volume (`V: DriveVault Unified Pool`).
* **Real-time Quota Bars**: Windows-accurate capacity bars with threshold coloring (blue for healthy, red for >90% full).
* **Tile / Details View**: Switch between grid tiles and comprehensive drive metric tables.

### 🧩 Intelligent Multi-Drive Chunking
* **Automatic Split Uploads**: Files larger than any single account's capacity are split into parallel chunks (16MB standard blocks) and distributed across accounts with remaining quota.
* **Transparent Reconstruction**: Seamless streaming download endpoint (`/api/download`) reconstructs chunks sequentially without storing temporary files on local disk.

### 🖼️ In-App File Preview & Media Player
* **Direct Browser Previews**: View media and documents with zero download delay.
* **Media Formats**: Video streaming (`.mp4`, `.webm`), audio visualizer player (`.mp3`, `.wav`, `.flac`), and full-resolution image viewer (`.png`, `.jpg`, `.webp`, `.svg`).
* **Documents & Code**: Built-in PDF reader and syntax-highlighted code/text reader with one-click clipboard copy.

### 🧹 Smart Storage Optimizer & Deduplication
* **Duplicate Finder**: Automatically scans across all connected drives to identify replicated files matching name and byte size.
* **One-Click Reclaim**: Keep the primary copy and batch-recycle all duplicate copies to immediately free up pool storage.
* **Space-Hog Analytics**: Lists top 10 largest individual files consuming aggregated capacity.

### 🔗 Password-Protected Link Sharing
* **Public Share Links**: Generate shareable download URLs with custom access codes (`/share/[code]`).
* **Security Controls**: Optional bcrypt-hashed password protection and configurable expiry timers (1 hour, 24 hours, 7 days, permanent).

### 📁 Virtual Directories & File Moving
* **Windows Folders**: Create virtual folder hierarchies without altering raw files in Google Drive root.
* **Organize Anywhere**: Move single-drive or chunked multi-drive files between folders with one click.

### ♻️ 3-Step Safety Recycle Bin
* **Soft Delete Trash**: Accidental deletions are quarantined in the Recycle Bin for safe restoration.
* **Hard Cloud Purge**: 3-step security authorization (File Check ➔ Cloud Warning ➔ Security Unlock Code) before permanently erasing files from Google Drive cloud.

### 📜 Real-Time Audit Activity Timeline
* Audit logging tracking every upload, download, share generation, move, rename, restore, and permanent deletion with timestamps.

---

## 🛠️ Tech Stack

* **Framework**: [Next.js 16](https://nextjs.org) (App Router, Turbopack)
* **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
* **Database & ORM**: SQLite / PostgreSQL via [Prisma ORM](https://www.prisma.io)
* **Cloud Storage**: Google Drive API v3 (`googleapis`)
* **Encryption & Auth**: AES-256-GCM token encryption, bcryptjs, JSON Web Tokens

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Ashish9078/drive-vault.git
cd drive-vault
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the project root:
```env
# Database
DATABASE_URL="file:./dev.db"

# Google OAuth 2.0 Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback"

# AES-256-GCM 32-byte encryption key for storing refresh tokens safely
ENCRYPTION_KEY="your-64-character-hex-encryption-key"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Push database schema
```bash
npx prisma db push
```

### 5. Start the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project: `DriveVault`.
3. Enable **Google Drive API** under **APIs & Services**.
4. In **OAuth consent screen**:
   - Set User Type to **External**.
   - Fill in App name and developer email.
   - Click **Publish App** to allow any Google user to link their account.
5. In **Credentials**:
   - Create **OAuth client ID** ➔ **Web application**.
   - Add Authorized JavaScript origin: `http://localhost:3000`
   - Add Authorized redirect URI: `http://localhost:3000/api/auth/callback`
6. Copy the **Client ID** and **Client Secret** into your `.env` file.

---

## 🌐 API Routes

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth` | `GET` | Initiates OAuth flow with required Google Drive scopes |
| `/api/auth/callback` | `GET` | Handles OAuth exchange and securely stores encrypted tokens |
| `/api/accounts` | `GET`, `DELETE`, `POST` | Fetches drive quotas, removes drives, or seeds demo accounts |
| `/api/files` | `GET`, `DELETE`, `PATCH` | Lists pooled files, manages soft/hard deletes, renames & moves |
| `/api/upload` | `POST`, `GET` | Handles resumable chunked uploads across drives |
| `/api/download` | `GET` | Streams single and multi-chunk reconstructed files |
| `/api/share` | `GET`, `POST` | Generates and inspects password-protected shareable links |
| `/api/storage-optimizer` | `GET` | Analyzes pool for duplicate files and space hogs |
| `/api/audit-logs` | `GET` | Returns chronological audit log entries |

---

## 🛡️ Security & Encryption

* **Token Protection**: All Google OAuth access and refresh tokens are encrypted at rest using **AES-256-GCM** with random initialization vectors (IVs) and authentication tags.
* **Client-Side Zero Access**: Plaintext tokens are never exposed to the client browser.
* **Destructive Action Guards**: Mandatory verification code input prevents misclicks from erasing cloud storage.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

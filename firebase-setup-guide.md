# Asolace PM — Firebase + Vercel Deployment Guide

## Architecture

```
Frontend (Vercel)          Backend (Firebase)
├── React (Vite)           ├── Firebase Auth (Google OAuth)
├── project-manager.jsx    ├── Firestore (Database)
└── firebase.js            └── Security Rules
```

---

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** → name it `asolace-pm`
3. Disable Google Analytics (optional for PM tool)
4. Click **Create project**

---

## Step 2: Enable Authentication

1. In Firebase Console → **Authentication** → **Get started**
2. Click **Sign-in method** tab → **Google** → **Enable**
3. Set the support email to your `@asolace.com` email
4. Save

### Restrict to @asolace.com Domain

The domain restriction is enforced in the app code (after Google sign-in, we check the email domain and reject non-asolace accounts). Firebase Auth doesn't have a built-in domain filter, so we handle it client-side + Firestore security rules.

---

## Step 3: Create Firestore Database

1. In Firebase Console → **Firestore Database** → **Create database**
2. Choose **Start in production mode**
3. Select a location close to you (e.g., `us-east1`)
4. Click **Enable**

### Set Firestore Security Rules

Go to **Firestore** → **Rules** tab → replace with:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: check if user is authenticated with @asolace.com
    function isAsolace() {
      return request.auth != null &&
             request.auth.token.email.matches('.*@asolace[.]com');
    }

    // Helper: get user's role
    function getRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isOwner() { return isAsolace() && getRole() == 'owner'; }
    function isManager() { return isAsolace() && getRole() == 'manager'; }
    function isOwnerOrManager() { return isOwner() || isManager(); }

    // Users collection
    match /users/{userId} {
      allow read: if isAsolace();
      allow create: if isAsolace() && request.auth.uid == userId;
      allow update: if isOwner();
      allow delete: if isOwner() && request.auth.uid != userId;
    }

    // Employees collection
    match /employees/{empId} {
      allow read: if isAsolace();
      allow create, update, delete: if isOwnerOrManager();
    }

    // Projects collection
    match /projects/{projectId} {
      allow read: if isAsolace();
      allow create, delete: if isOwnerOrManager();
      allow update: if isAsolace();
    }

    // Teams collection
    match /teams/{teamId} {
      allow read: if isAsolace();
      allow create, update, delete: if isOwnerOrManager();
    }

    // Settings collection (templates, branding, etc.)
    match /settings/{docId} {
      allow read: if isAsolace();
      allow create, update, delete: if isOwnerOrManager();
    }
  }
}
```

Click **Publish**.

---

## Step 4: Get Firebase Config

1. In Firebase Console → **Project Settings** (gear icon)
2. Scroll to **Your apps** → click **Web** (</> icon)
3. Register the app name: `asolace-pm`
4. Copy the config object — you'll need it for Step 5

It looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "asolace-pm.firebaseapp.com",
  projectId: "asolace-pm",
  storageBucket: "asolace-pm.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc...",
};
```

---

## Step 5: Set Up the Project Locally

### Create the Vite + React project

```bash
npm create vite@latest asolace-pm -- --template react
cd asolace-pm
npm install
npm install firebase
```

### Add Environment Variables

Create `.env.local` in the project root:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=asolace-pm.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=asolace-pm
VITE_FIREBASE_STORAGE_BUCKET=asolace-pm.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc...
```

### Add the Files

Copy these files into your project:

- `src/firebase.js` — Firebase initialization
- `src/App.jsx` — Replace with `project-manager.jsx`

### Update `src/main.jsx`

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import ProjectManager from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ProjectManager />
  </React.StrictMode>,
);
```

### Update `index.html`

Add the Google font in the `<head>`:

```html
<link
  href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
  rel="stylesheet"
/>
```

### Run Locally

```bash
npm run dev
```

---

## Step 6: Deploy to Vercel

### Option A: GitHub (recommended)

1. Push your project to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo
4. Add environment variables (same as `.env.local`, but without `VITE_` prefix isn't needed — keep them as-is)
5. Deploy

### Option B: CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

When prompted, add the env vars.

### Add Vercel URL to Firebase

1. After deploying, copy your Vercel URL (e.g., `asolace-pm.vercel.app`)
2. In Firebase Console → **Authentication** → **Settings** → **Authorized domains**
3. Add your Vercel domain

---

## Step 7: Add Authorized Domains

Firebase Auth requires whitelisting domains that can use Google sign-in:

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Make sure these are listed:
   - `localhost` (for dev)
   - `asolace-pm.vercel.app` (your production URL)
   - Any custom domain you add later

---

## File Structure

```
asolace-pm/
├── .env.local              # Firebase config (not committed)
├── .gitignore
├── api/
│   └── create-project.js   # Vercel serverless API for external integrations
├── index.html
├── package.json
├── vite.config.js
├── vercel.json             # Optional: SPA routing
└── src/
    ├── main.jsx
    ├── firebase.js          # Firebase init + auth + db helpers
    └── App.jsx              # Main PM app (project-manager.jsx)
```

### vercel.json (for SPA routing)

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## External API (Zapier / Make / Webhooks)

The app exposes a REST endpoint at `/api/create-project` for creating projects from external tools.

### Setup

1. **Generate a Firebase Service Account Key**
   - Firebase Console → **Project Settings** → **Service Accounts**
   - Click **Generate New Private Key** → download the JSON file

2. **Add Environment Variables** (in Vercel Dashboard → Settings → Environment Variables):
   | Variable | Value |
   |---|---|
   | `API_SECRET_KEY` | Any strong random string (acts as your API password) |
   | `FIREBASE_PROJECT_ID` | From the service account JSON (`project_id`) |
   | `FIREBASE_CLIENT_EMAIL` | From the service account JSON (`client_email`) |
   | `FIREBASE_PRIVATE_KEY` | From the service account JSON (`private_key`) — include the `-----BEGIN...` and `-----END...` parts |

3. **Redeploy** your Vercel project so the new env vars take effect.

### API Usage

**Endpoint:** `POST https://your-domain.vercel.app/api/create-project`

**Headers:**

```
Content-Type: application/json
X-API-Key: your-api-secret-key
```

(or `Authorization: Bearer your-api-secret-key`)

**Body (JSON):**

```json
{
  "projectName": "Acme Corp Website Redesign",
  "projectPriority": "high",
  "projectStatus": "active",
  "projectAssignee": "someone@asolace.com",
  "industry": "SaaS",
  "pointOfContact": "Jane Doe",
  "pocEmail": "jane@acme.com",
  "pocPhone": "(555) 123-4567",
  "bizEmail": "billing@acme.com",
  "bizPhone": "(555) 987-6543",
  "address": "123 Main St",
  "website": "https://acme.com",
  "googleDoc": "https://docs.google.com/...",
  "notes": "Referred by partner",
  "additionalContacts": [
    { "name": "Bob Smith", "email": "bob@acme.com", "phone": "(555) 111-2222" }
  ]
}
```

Only `projectName` (or `name`) is required. All other fields are optional.

**Success Response (201):**

```json
{
  "success": true,
  "id": "proj_1709654321000",
  "name": "Acme Corp Website Redesign",
  "message": "Project \"Acme Corp Website Redesign\" created successfully."
}
```

**Error Responses:**

- `401` — Invalid or missing API key
- `405` — Wrong HTTP method (must be POST)
- `500` — Server error

### Zapier Setup

1. Create a new Zap → choose your trigger (e.g., new form submission, new email, etc.)
2. Add action → **Webhooks by Zapier** → **POST**
3. URL: `https://your-domain.vercel.app/api/create-project`
4. Payload Type: `json`
5. Headers: `X-API-Key: your-api-secret-key`
6. Map your trigger fields to the body fields above

### Available Fields

| Field                | Type   | Description                                  |
| -------------------- | ------ | -------------------------------------------- |
| `projectName`        | string | **Required.** Project name                   |
| `projectPriority`    | string | `low`, `medium`, `high`, `urgent`            |
| `projectStatus`      | string | `active`, `paused`, `completed`, `cancelled` |
| `projectAssignee`    | string | Assignee email                               |
| `industry`           | string | Industry label                               |
| `websiteLaunchDate`  | string | Date string                                  |
| `seoStartDate`       | string | Date string                                  |
| `pointOfContact`     | string | Primary contact name                         |
| `pocEmail`           | string | Primary contact email                        |
| `pocPhone`           | string | Primary contact phone                        |
| `bizEmail`           | string | Business email                               |
| `bizPhone`           | string | Business phone                               |
| `address`            | string | Business address                             |
| `website`            | string | Website URL                                  |
| `googleDoc`          | string | Google Doc URL                               |
| `facebook`           | string | Facebook URL                                 |
| `instagram`          | string | Instagram URL                                |
| `linkedin`           | string | LinkedIn URL                                 |
| `twitter`            | string | Twitter/X URL                                |
| `youtube`            | string | YouTube URL                                  |
| `tiktok`             | string | TikTok URL                                   |
| `gbp`                | string | Google Business Profile URL                  |
| `notes`              | string | Free-text notes                              |
| `additionalContacts` | array  | `[{ name, email, phone }]`                   |

---

## First Login Flow

1. First user to sign in with `@asolace.com` → automatically becomes **Owner**
2. Subsequent users → join as **Employee**
3. Owner can promote users to **Manager** or **Owner** from the Users & Roles page

---

## Troubleshooting

| Issue                        | Fix                                              |
| ---------------------------- | ------------------------------------------------ |
| Google sign-in popup blocked | Allow popups for your domain                     |
| "auth/unauthorized-domain"   | Add domain to Firebase Auth → Authorized domains |
| Firestore permission denied  | Check security rules are published               |
| Data not showing             | Check browser console for Firestore errors       |
| `.env.local` not loading     | Restart `npm run dev` after changing env vars    |

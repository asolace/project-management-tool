# Asolace PM — Digital Marketing Project Management Tool

A full-featured project management tool built for digital marketing teams. Manage projects, tasks, teams, and client details with role-based access control, task templates, and external API integration.

## Tech Stack

- **Frontend:** React 18 + Vite 6
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication (Google OAuth, restricted to `@asolace.com`)
- **Hosting:** Vercel
- **API:** Vercel Serverless Functions (for external integrations like Zapier)

## Features

- **Project Management** — Create, edit, and track digital marketing projects with client details, contacts, social media links, key dates, and notes
- **Task Management** — Kanban-style task board with priorities, statuses, effort levels, task types, due dates, subtasks, and assignees
- **Task Templates** — Reusable template groups for bulk task creation on new projects
- **Role-Based Access** — Owner, Manager, and Employee roles with granular permissions
- **Team Management** — Organize users into teams with project assignments
- **External API/Webhook** — REST API endpoint for creating projects from external tools (Zapier, Make, etc.)
- **Rich Text Notes** — HTML editor for project notes with formatting support

## Project Structure

```
├── src/
│   ├── App.jsx          # Main application (single-file React app)
│   └── main.jsx         # Entry point
├── api/
│   └── create-project.js  # Vercel serverless function (webhook API)
├── firebase.js          # Firebase config, auth, and Firestore helpers
├── index.html           # HTML shell
├── vite.config.js       # Vite configuration
├── vercel.json          # Vercel routing (SPA + API rewrites)
├── package.json
├── .env.example         # Environment variable template
└── firebase-setup-guide.md  # Full Firebase/Vercel setup guide
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A [Firebase](https://firebase.google.com/) project
- A [Vercel](https://vercel.com/) account (for deployment)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/Digital-Marketing-Project-Management-Tool.git
cd Digital-Marketing-Project-Management-Tool
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Firebase

Follow the detailed instructions in [firebase-setup-guide.md](firebase-setup-guide.md), or the quick version:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Enable **Google Authentication**
3. Create a **Firestore Database** in production mode
4. Publish the Firestore security rules (see [firebase-setup-guide.md](firebase-setup-guide.md))
5. Get your Firebase config from **Project Settings → Your apps → Web app**

### 4. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Fill in the **client-side** Firebase config:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:abcdef123456
```

For the **webhook API** (optional, only needed for external integrations):

```env
API_SECRET_KEY=your-random-secret-key
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> **Note:** The `FIREBASE_PRIVATE_KEY` must include the full PEM wrapper (`-----BEGIN/END PRIVATE KEY-----`) and be wrapped in double quotes. Get it from Firebase Console → Project Settings → Service Accounts → Generate New Private Key.

### 5. Run Locally

**Frontend only** (for UI development):

```bash
npm run dev
```

This starts Vite at `http://localhost:5173`. The app connects to your Firebase backend directly.

**Full stack with API** (for testing webhooks locally):

```bash
npx vercel dev
```

This starts the Vercel dev server at `http://localhost:3000`, serving both the frontend and the `/api/create-project` serverless function.

> **Note:** The first time you run `vercel dev`, it will prompt you to link to a Vercel project. You can also install the Vercel CLI globally: `npm i -g vercel`.

### 6. Build for Production

```bash
npm run build
```

Output goes to `dist/`.

## Deployment (Vercel)

### First-Time Setup

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com/) → Import your repository
3. Set the **Framework Preset** to **Vite**
4. Add all environment variables from `.env.example` in the Vercel dashboard (Settings → Environment Variables)
5. Deploy

### Add Firebase Authorized Domain

After deploying, add your Vercel domain to Firebase:

1. Firebase Console → Authentication → Settings → Authorized domains
2. Add `your-project.vercel.app`

### Subsequent Deployments

Every push to `main` triggers an automatic deployment on Vercel.

## API / Webhook

The app includes a REST API endpoint for creating projects externally (e.g., from Zapier, Make, or any HTTP client).

### Endpoint

```
POST https://your-domain.vercel.app/api/create-project
```

### Headers

| Header         | Value                       |
| -------------- | --------------------------- |
| `Content-Type` | `application/json`          |
| `X-API-Key`    | Your `API_SECRET_KEY` value |

### Example Request

```bash
curl -X POST https://your-domain.vercel.app/api/create-project \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-secret-key" \
  -d '{
    "projectName": "New Client Project",
    "projectPriority": "high",
    "projectStatus": "active",
    "pointOfContact": "John Smith",
    "pocEmail": "john@example.com",
    "industry": "Plumbing"
  }'
```

### Example Response

```json
{
  "success": true,
  "id": "proj_1772803102813",
  "name": "New Client Project",
  "message": "Project \"New Client Project\" created successfully."
}
```

### Supported Fields

| Field                | Type   | Required | Description                                                  |
| -------------------- | ------ | -------- | ------------------------------------------------------------ |
| `projectName`        | string | **Yes**  | Project / business name                                      |
| `projectPriority`    | string | No       | `trivial`, `low`, `medium`, `high`, `critical`               |
| `projectStatus`      | string | No       | `not_started`, `active`, `on_hold`, `completed`, `cancelled` |
| `projectAssignee`    | string | No       | User ID of the assignee                                      |
| `industry`           | string | No       | Business industry                                            |
| `pointOfContact`     | string | No       | Primary contact name                                         |
| `pocEmail`           | string | No       | Primary contact email                                        |
| `pocPhone`           | string | No       | Primary contact phone                                        |
| `bizEmail`           | string | No       | Business email                                               |
| `bizPhone`           | string | No       | Business phone                                               |
| `address`            | string | No       | Business address                                             |
| `website`            | string | No       | Website URL                                                  |
| `googleDoc`          | string | No       | Google Doc link                                              |
| `facebook`           | string | No       | Facebook URL                                                 |
| `instagram`          | string | No       | Instagram handle                                             |
| `linkedin`           | string | No       | LinkedIn URL                                                 |
| `twitter`            | string | No       | X/Twitter handle                                             |
| `youtube`            | string | No       | YouTube URL                                                  |
| `tiktok`             | string | No       | TikTok handle                                                |
| `gbp`                | string | No       | Google Business Profile URL                                  |
| `websiteLaunchDate`  | string | No       | Date (YYYY-MM-DD or ISO 8601)                                |
| `seoStartDate`       | string | No       | Date (YYYY-MM-DD or ISO 8601)                                |
| `projectClosedDate`  | string | No       | Date (YYYY-MM-DD or ISO 8601)                                |
| `notes`              | string | No       | HTML or plain text notes                                     |
| `additionalContacts` | array  | No       | Array of `{ name, email, phone }`                            |

### Testing the Webhook Locally

1. Make sure your `.env` (or `.env.local`) has the server-side variables set
2. Start the Vercel dev server: `npx vercel dev`
3. Send a test request:

```bash
curl -X POST http://localhost:3000/api/create-project \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-secret-key" \
  -d @test-payload.json
```

> **Tip on Windows PowerShell:** Use `curl.exe` (not `curl` alias) and put the JSON body in a file with `-d @filename.json` to avoid escaping issues.

## User Roles

| Role         | Permissions                                                             |
| ------------ | ----------------------------------------------------------------------- |
| **Owner**    | Full access — manage users, projects, tasks, teams, templates, settings |
| **Manager**  | Create/edit/delete projects and tasks, manage teams                     |
| **Employee** | View assigned tasks, update task status only                            |

The owner is hardcoded to `jackhe@asolace.com`. Only the owner can change user roles.

## Scripts

| Command           | Description                                 |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start Vite dev server (frontend only)       |
| `npm run build`   | Build for production                        |
| `npm run preview` | Preview production build locally            |
| `npx vercel dev`  | Start full-stack local dev (frontend + API) |

## Additional Documentation

- [firebase-setup-guide.md](firebase-setup-guide.md) — Detailed Firebase project setup, Firestore rules, Vercel deployment, and API documentation

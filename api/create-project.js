import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Fields accepted from external requests (mirrors PROJECT_FIELDS in App.jsx)
const VALID_FIELDS = [
  "projectName",
  "projectPriority",
  "projectStatus",
  "projectAssignee",
  "industry",
  "websiteLaunchDate",
  "seoStartDate",
  "projectClosedDate",
  "pointOfContact",
  "pocEmail",
  "pocPhone",
  "bizEmail",
  "bizPhone",
  "address",
  "website",
  "googleDoc",
  "facebook",
  "instagram",
  "linkedin",
  "twitter",
  "youtube",
  "tiktok",
  "gbp",
  "notes",
];

// Date fields that should be normalized to YYYY-MM-DD
const DATE_FIELDS = ["websiteLaunchDate", "seoStartDate", "projectClosedDate"];

// Convert UTC/ISO timestamps to YYYY-MM-DD
function toDateString(val) {
  if (!val) return null;
  const s = val.toString().trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try parsing as date (handles ISO 8601, UTC strings, etc.)
  const d = new Date(s);
  if (isNaN(d.getTime())) return s; // unparseable — pass through as-is
  return d.toISOString().slice(0, 10); // extract YYYY-MM-DD
}

function getDb() {
  if (!getApps().length) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(
      /\\n/g,
      "\n",
    );

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        `Missing Firebase env vars: ${!projectId ? "FIREBASE_PROJECT_ID " : ""}${!clientEmail ? "FIREBASE_CLIENT_EMAIL " : ""}${!privateKey ? "FIREBASE_PRIVATE_KEY" : ""}`.trim(),
      );
    }

    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  // ─── CORS ───
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key",
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // ─── Auth via API key ───
  const apiKey =
    req.headers["authorization"]?.replace("Bearer ", "") ||
    req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized. Invalid API key." });
  }

  // ─── Build project document ───
  try {
    const db = getDb();
    const body = req.body || {};
    const project = {};

    // Copy valid scalar fields
    for (const key of VALID_FIELDS) {
      if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
        project[key] = body[key];
      }
    }

    // Normalize date fields from UTC/ISO to YYYY-MM-DD
    for (const key of DATE_FIELDS) {
      if (project[key]) project[key] = toDateString(project[key]);
    }

    // Additional contacts (array of { name, email, phone })
    if (Array.isArray(body.additionalContacts)) {
      const contacts = body.additionalContacts.filter(
        (c) =>
          c &&
          (c.name?.toString().trim() ||
            c.email?.toString().trim() ||
            c.phone?.toString().trim()),
      );
      if (contacts.length) {
        project.additionalContacts = contacts.map((c) => ({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: c.name || "",
          email: c.email || "",
          phone: c.phone || "",
        }));
      }
    }

    // Required: project name
    project.name =
      body.projectName?.toString().trim() ||
      body.name?.toString().trim() ||
      "Untitled";
    if (!project.projectName) project.projectName = project.name;

    // Defaults
    project.tasks = [];
    project.createdAt = Date.now();
    if (!project.projectStatus) project.projectStatus = "active";

    const id = "proj_" + Date.now();
    await db.collection("projects").doc(id).set(project);

    return res.status(201).json({
      success: true,
      id,
      name: project.name,
      message: `Project "${project.name}" created successfully.`,
    });
  } catch (err) {
    console.error("create-project error:", err);
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
}

// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const ALLOWED_DOMAIN = "asolace.com";
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ hd: ALLOWED_DOMAIN });

// ─── Auth ───

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const email = result.user.email;

  if (!email.endsWith("@" + ALLOWED_DOMAIN)) {
    await signOut(auth);
    throw new Error("Only @" + ALLOWED_DOMAIN + " accounts are allowed.");
  }

  // Check if user doc exists, if not create one
  const userRef = doc(db, "users", result.user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // Only jackhe@asolace.com gets the owner role
    const isOwner = email === "jackhe@asolace.com";

    await setDoc(userRef, {
      email: email,
      name: result.user.displayName || email.split("@")[0],
      photoURL: result.user.photoURL || null,
      role: isOwner ? "owner" : "employee",
      createdAt: serverTimestamp(),
    });
  }

  return result.user;
}

export async function logOut() {
  return signOut(auth);
}

export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// ─── Firestore Helpers ───

// Users
export function subscribeUsers(callback) {
  return onSnapshot(collection(db, "users"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function updateUserRole(userId, newRole) {
  return updateDoc(doc(db, "users", userId), { role: newRole });
}

export async function deleteUser(userId) {
  return deleteDoc(doc(db, "users", userId));
}

// Employees
export function subscribeEmployees(callback) {
  return onSnapshot(collection(db, "employees"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addEmployeeDoc(data) {
  const id = "emp_" + Date.now();
  await setDoc(doc(db, "employees", id), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function deleteEmployeeDoc(id) {
  return deleteDoc(doc(db, "employees", id));
}

// Projects
export function subscribeProjects(callback) {
  return onSnapshot(collection(db, "projects"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Teams
export function subscribeTeams(callback) {
  return onSnapshot(collection(db, "teams"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addTeamDoc(data) {
  const id = "team_" + Date.now();
  await setDoc(doc(db, "teams", id), {
    ...data,
    members: data.members || [],
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function updateTeamDoc(id, data) {
  return updateDoc(doc(db, "teams", id), data);
}

export async function deleteTeamDoc(id) {
  return deleteDoc(doc(db, "teams", id));
}

export async function addProjectDoc(data) {
  const id = "proj_" + Date.now();
  await setDoc(doc(db, "projects", id), {
    tasks: [],
    ...data,
    createdAt: Date.now(),
  });
  return id;
}

export async function updateProjectDoc(id, data) {
  return updateDoc(doc(db, "projects", id), data);
}

export async function deleteProjectDoc(id) {
  return deleteDoc(doc(db, "projects", id));
}

// Task Templates (grouped)
export function subscribeTaskTemplates(callback) {
  return onSnapshot(doc(db, "settings", "taskTemplates"), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      // Support new groups format + backward compat with flat templates
      if (data.groups) {
        callback(data.groups);
      } else if (data.templates && data.templates.length) {
        callback([
          { id: "default", name: "Default", templates: data.templates },
        ]);
      } else {
        callback([]);
      }
    } else {
      callback([]);
    }
  });
}

export async function updateTaskTemplates(groups) {
  return setDoc(doc(db, "settings", "taskTemplates"), { groups });
}

// Branding settings
export function subscribeBranding(callback) {
  return onSnapshot(doc(db, "settings", "branding"), (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    } else {
      callback({});
    }
  });
}

export async function updateBranding(data) {
  return setDoc(doc(db, "settings", "branding"), data, { merge: true });
}

export { ALLOWED_DOMAIN };

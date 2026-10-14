// Firebase bootstrap: initialises the app and re-exports the SDK helpers used across the project.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export * from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
export * from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbIZ4OPm7PzmAuw65kmJFPjozozkqJvOg",
  authDomain: "eventmanagementapp-47c76.firebaseapp.com",
  projectId: "eventmanagementapp-47c76",
  storageBucket: "eventmanagementapp-47c76.firebasestorage.app",
  messagingSenderId: "548729511292",
  appId: "1:548729511292:web:9e9ff08065a776f88798f9",
  measurementId: "G-D2SF29N840"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

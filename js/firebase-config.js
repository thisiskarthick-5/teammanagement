// Firebase Configuration - REPLACE WITH YOUR KEYS
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBg7m0s-PkYNogrpKtZPYwpbYaS9eLQRmc",
    authDomain: "team-1e152.firebaseapp.com",
    projectId: "team-1e152",
    storageBucket: "team-1e152.firebasestorage.app",
    messagingSenderId: "850072284487",
    appId: "1:850072284487:web:a9e1f75664de809f1df062",
    measurementId: "G-5P3PQ9Z7YZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Groq AI Assistant Configuration
// REPLACE WITH YOUR GROQ API KEY
export const GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE";
export const GROQ_MODEL = "llama-3.3-70b-versatile";

// EmailJS Configuration (Optional - for Email Notifications)
export const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
export const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";
export const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY";

export { auth, db };

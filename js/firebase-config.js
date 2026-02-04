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

export { auth, db };

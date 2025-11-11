// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail // Already imported later, but kept here for clarity
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// 🚨 ADD 1: Import Realtime Database
import { 
    getDatabase, 
    ref, 
    set, 
    serverTimestamp // Helper for creating server-side timestamp
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";


// Your Firebase config (use your actual values)
const firebaseConfig = {
  apiKey: "AIzaSyBbMbQbZciSXI098pYAdQe1FJiWdjsNGx0",
  authDomain: "mindease-b9b6f.firebaseapp.com",
  projectId: "mindease-b9b6f",
  storageBucket: "mindease-b9b6f.firebasestorage.app",
  messagingSenderId: "376295406434",
  appId: "1:376295406434:web:c66e8ff859400b49da8a3b",
  // 🚨 IMPORTANT: Add databaseURL if it's not the default
  databaseURL: "https://mindease-b9b6f-default-rtdb.firebaseio.com" // Use your verified URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// 🚨 ADD 2: Initialize Realtime Database
const db = getDatabase(app); 


// Signup Logic
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;
    
    // 🚨 ASSUMPTION: You must collect the user's name from your HTML form.
    // Assuming you have an input field with id="signupName"
    const name = document.getElementById("signupName").value;

    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        const uid = user.uid; // Get the unique ID for the database key

        // 🚨 ADD 3: Write the user data to the Realtime Database
        const userRef = ref(db, 'users/' + uid);
        
        return set(userRef, {
            email: email, // Use the email from the form
            name: name,   // Use the name from the form
            createdAt: serverTimestamp() // Use Firebase's server timestamp
        });
      })
      .then(() => {
        // This runs AFTER both Auth and Database write are successful
        
        window.location.href = "login.html";
      })
      .catch((error) => {
        alert(error.message);
      });
  });
}

// ... (Rest of the code remains the same)

// Login Logic
const loginForm = document.getElementById("loginForm");
// ... (omitted for brevity)
if (loginForm) {
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        
        window.location.href = "dashboard.html";
      })
      .catch((error) => {
        alert("Invalid email or password");
      });
  });
}
// ... (omitted for brevity)
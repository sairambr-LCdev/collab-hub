import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
// import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyA7jG2289PFvzfri2qehT0Abl6vIslEIjY",
  authDomain: "collab-hub-b84c3.firebaseapp.com",
  projectId: "collab-hub-b84c3",
  storageBucket: "collab-hub-b84c3.firebasestorage.app",
  messagingSenderId: "78469426304",
  appId: "1:78469426304:web:f28b0747eb195bb0424a65",
  measurementId: "G-LR9YV7PRZJ"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Export Firebase Services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
// export const analytics = getAnalytics(app);

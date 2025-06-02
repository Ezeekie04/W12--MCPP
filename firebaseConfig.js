import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyBuiTQMMlPRJsy39bIvk_KL-61HLEyCWdM",
  authDomain: "tugas11-aafa4.firebaseapp.com",
  projectId: "tugas11-aafa4",
  storageBucket: "tugas11-aafa4.firebasestorage.app",
  messagingSenderId: "413638001037",
  appId: "1:413638001037:web:bf6a93fbf84fdd53f77dc4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export default firebaseConfig;

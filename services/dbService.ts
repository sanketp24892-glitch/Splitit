
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc,
  arrayUnion
} from "firebase/firestore";
import { SplitEvent, Participant, Expense } from "../types.ts";

// Note: Using a slightly more realistic placeholder to satisfy SDK validation
const firebaseConfig = {
  apiKey: "AIzaSySplitIt_RealTime_Sync_Key",
  authDomain: "splitit-sync-app.firebaseapp.com",
  projectId: "splitit-sync-app",
  storageBucket: "splitit-sync-app.appspot.com",
  messagingSenderId: "987654321",
  appId: "1:987654321:web:a1b2c3d4e5f6"
};

let db: any;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase initialization failed. Running in local-only mode.", e);
}

export const saveEventToCloud = async (event: SplitEvent) => {
  if (!db) return;
  try {
    const eventRef = doc(db, "events", event.id);
    await setDoc(eventRef, event, { merge: true });
  } catch (e) {
    console.error("Cloud Save Error:", e);
  }
};

export const subscribeToEvent = (eventId: string, callback: (event: SplitEvent | null) => void) => {
  if (!db) return () => {};
  return onSnapshot(doc(db, "events", eventId), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as SplitEvent);
    } else {
      callback(null);
    }
  }, (error) => {
    console.warn("Firestore subscription inactive:", error.message);
  });
};

export const addParticipantCloud = async (eventId: string, participant: Participant) => {
  if (!db) return;
  const eventRef = doc(db, "events", eventId);
  await updateDoc(eventRef, {
    participants: arrayUnion(participant)
  });
};

export const addExpenseCloud = async (eventId: string, expense: Expense) => {
  if (!db) return;
  const eventRef = doc(db, "events", eventId);
  await updateDoc(eventRef, {
    expenses: arrayUnion(expense)
  });
};

export const updateExpensesCloud = async (eventId: string, expenses: Expense[]) => {
  if (!db) return;
  const eventRef = doc(db, "events", eventId);
  await updateDoc(eventRef, { expenses });
};

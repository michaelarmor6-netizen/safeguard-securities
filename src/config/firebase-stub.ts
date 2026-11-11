// Temporary stub - exports everything the app expects from Firebase
export const initializeApp = () => ({});
export const getAuth = () => ({
  currentUser: null,
  onAuthStateChanged: () => () => {},
  signOut: async () => {},
});
export const getFirestore = () => ({});
export const getStorage = () => ({});
export const getFunctions = () => ({});

export const auth = getAuth();
export const db = getFirestore();
export const storage = getStorage();
export const functions = getFunctions();
export const app = {};

// Common Firestore helpers (no-ops)
export const collection = () => ({});
export const doc = () => ({});
export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
export const getDocs = async () => ({ empty: true, docs: [], forEach: () => {} });
export const setDoc = async () => {};
export const updateDoc = async () => {};
export const addDoc = async () => ({ id: 'stub' });
export const deleteDoc = async () => {};
export const onSnapshot = () => () => {};
export const query = () => ({});
export const where = () => ({});
export const orderBy = () => ({});
export const limit = () => ({});
export const serverTimestamp = () => new Date();
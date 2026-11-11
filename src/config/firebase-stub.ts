const noop = () => {};
const asyncNoop = async () => {};

export const initializeApp = () => ({});
export const getAuth = () => ({
  currentUser: null,
  onAuthStateChanged: () => noop,
  signOut: asyncNoop,
});
export const getFirestore = () => ({});
export const getStorage = () => ({});
export const getFunctions = () => ({});

export const enableNetwork = asyncNoop;
export const disableNetwork = asyncNoop;
export const connectFirestoreEmulator = noop;

// Auth functions used by AuthContext and others
export const onAuthStateChanged = () => noop;
export const signInWithEmailAndPassword = asyncNoop;
export const createUserWithEmailAndPassword = asyncNoop;
export const signOut = asyncNoop;
export const sendPasswordResetEmail = asyncNoop;
export const sendEmailVerification = asyncNoop;
export const updateProfile = asyncNoop;
export const updatePassword = asyncNoop;
export const reauthenticateWithCredential = asyncNoop;
export const EmailAuthProvider = { credential: () => ({}) };

// Firestore
export const collection = () => ({});
export const doc = () => ({});
export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
export const getDocs = async () => ({ empty: true, docs: [], forEach: noop });
export const setDoc = asyncNoop;
export const updateDoc = asyncNoop;
export const addDoc = async () => ({ id: 'stub' });
export const deleteDoc = asyncNoop;
export const onSnapshot = () => noop;
export const query = () => ({});
export const where = () => ({});
export const orderBy = () => ({});
export const limit = () => ({});
export const serverTimestamp = () => new Date();

export const auth = getAuth();
export const db = getFirestore();
export const storage = getStorage();
export const functions = getFunctions();
export const app = {};
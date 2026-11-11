const noop = () => {};
const asyncNoop = async () => {};
const emptySnapshot = { exists: () => false, data: () => ({}), empty: true, docs: [], forEach: noop };

export const initializeApp = () => ({});
export const getAuth = () => ({ currentUser: null, onAuthStateChanged: () => noop, signOut: asyncNoop });
export const getFirestore = () => ({});
export const getStorage = () => ({});
export const getFunctions = () => ({});
export const enableNetwork = asyncNoop;
export const disableNetwork = asyncNoop;
export const connectFirestoreEmulator = noop;

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

export const collection = () => ({});
export const doc = () => ({});
export const getDoc = async () => emptySnapshot;
export const getDocFromServer = async () => emptySnapshot;
export const getDocs = async () => emptySnapshot;
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
export const signInWithCustomToken = asyncNoop;

export class FirebaseError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const auth = getAuth();
export const db = getFirestore();
export const storage = getStorage();
export const functions = getFunctions();
export const app = {};
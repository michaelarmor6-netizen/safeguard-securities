// Catch-all stub so any Firebase import resolves without crashing the build
const noop = () => {};
const asyncNoop = async () => {};
const emptyObj = {};

function createProxy(target: any = {}) {
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (typeof prop === 'string' && prop.startsWith('get')) return () => emptyObj;
      return noop;
    },
  });
}

export const initializeApp = () => emptyObj;
export const getAuth = () => createProxy({ currentUser: null, onAuthStateChanged: () => noop, signOut: asyncNoop });
export const getFirestore = () => emptyObj;
export const getStorage = () => emptyObj;
export const getFunctions = () => emptyObj;

export const enableNetwork = asyncNoop;
export const disableNetwork = asyncNoop;
export const connectFirestoreEmulator = noop;

export const auth = getAuth();
export const db = getFirestore();
export const storage = getStorage();
export const functions = getFunctions();
export const app = emptyObj;

export const collection = () => emptyObj;
export const doc = () => emptyObj;
export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
export const getDocs = async () => ({ empty: true, docs: [], forEach: noop });
export const setDoc = asyncNoop;
export const updateDoc = asyncNoop;
export const addDoc = async () => ({ id: 'stub' });
export const deleteDoc = asyncNoop;
export const onSnapshot = () => noop;
export const query = () => emptyObj;
export const where = () => emptyObj;
export const orderBy = () => emptyObj;
export const limit = () => emptyObj;
export const serverTimestamp = () => new Date();

// Export a default proxy for anything else
export default createProxy();
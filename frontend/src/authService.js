// authService.js
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup 
} from "./firebase";

export const loginUser = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const registerUser = async (email, password) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const subscribeToAuthChanges = (callback) => {
  return auth.onAuthStateChanged(callback);
};

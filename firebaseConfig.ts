import { FirebaseOptions, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";
import type { Functions } from "firebase/functions";

const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_REACT_APP_API_KEY,
    projectId: process.env.NEXT_PUBLIC_REACT_APP_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_REACT_APP_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_MESSAGIN_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_REACT_APP_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_REACT_APP_MEASUREMENT_ID,
    authDomain: process.env.NEXT_PUBLIC_REACT_APP_AUTH_DOMAIN
}

export const firebaseApp = initializeApp(firebaseConfig)
export const database = getFirestore(firebaseApp)

/**
 * Desenvolvimento com os emuladores do Firebase (`firebase emulators:start`):
 * defina NEXT_PUBLIC_USE_FIREBASE_EMULATORS=1 no .env.development.local.
 */
export const usingEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "1"
const EMU_HOST = "127.0.0.1"
if (usingEmulators && typeof window !== "undefined") {
    connectAuthEmulator(getAuth(firebaseApp), `http://${EMU_HOST}:9099`, { disableWarnings: true })
    connectFirestoreEmulator(database, EMU_HOST, 8080)
}

// Storage (playbacks em mp3). Carregado sob demanda para não pesar nas telas que não usam.
let storagePromise: Promise<FirebaseStorage> | null = null
export const getAppStorage = () => (storagePromise ??= import("firebase/storage").then(({ getStorage, connectStorageEmulator }) => {
    const storage = getStorage(firebaseApp)
    if (usingEmulators) connectStorageEmulator(storage, EMU_HOST, 9199)
    return storage
}))

let functionsPromise: Promise<Functions> | null = null
export const getAppFunctions = (region: string) => (functionsPromise ??= import("firebase/functions").then(({ getFunctions, connectFunctionsEmulator }) => {
    const functions = getFunctions(firebaseApp, region)
    if (usingEmulators) connectFunctionsEmulator(functions, EMU_HOST, 5001)
    return functions
}))

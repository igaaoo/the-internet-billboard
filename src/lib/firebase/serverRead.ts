import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { doc, getDoc, getFirestore } from "firebase/firestore/lite";
import { BillboardDoc, DEFAULT_BILLBOARD } from "./types";

// Versão "lite" do SDK — só busca uma vez, sem listener em tempo real.
// Pensada pra rodar em rotas de servidor (ex: geração de OG image), onde
// não faz sentido manter uma conexão aberta.
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export async function getCurrentBillboardForOg(): Promise<BillboardDoc> {
  if (!firebaseConfig.projectId) return DEFAULT_BILLBOARD;

  try {
    const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const snap = await getDoc(doc(db, "billboard", "current"));
    if (!snap.exists()) return DEFAULT_BILLBOARD;
    return { ...DEFAULT_BILLBOARD, ...(snap.data() as Partial<BillboardDoc>) };
  } catch {
    return DEFAULT_BILLBOARD;
  }
}

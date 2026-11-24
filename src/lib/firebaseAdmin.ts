/**
 * Firebase Admin (só no servidor): confere quem está chamando a API e guarda o uso diário da IA.
 *
 * - Conferir o login só precisa do ID do projeto.
 * - Gravar o uso diário precisa da conta de serviço em FIREBASE_SERVICE_ACCOUNT (JSON da chave,
 *   baixado em Firebase Console > Configurações do projeto > Contas de serviço). Sem ela, o limite
 *   vale por instância do servidor (melhor que nada, mas reinicia a cada deploy).
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { NextApiRequest } from 'next';

const projectId = process.env.NEXT_PUBLIC_REACT_APP_PROJECT_ID;

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT inválida: use o JSON da chave (ou o JSON em base64).');
    return null;
  }
}

const account = serviceAccount();

function adminApp(): App {
  return getApps()[0] ?? initializeApp(account ? { credential: cert(account), projectId } : { projectId });
}

export class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Usuário logado que fez a requisição (header Authorization: Bearer <ID token do Firebase>). */
export async function requireUser(req: NextApiRequest): Promise<{ uid: string }> {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError('Entre na sua conta para usar a IA.', 401);
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    throw new HttpError('Sua sessão expirou. Entre de novo.', 401);
  }
}

const memoryUsage = new Map<string, { day: string; count: number }>();
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD

/**
 * Conta um uso de `feature` para o usuário e recusa se passar do limite do dia.
 * Fica em aiUsage/{uid} (coleção fechada para o app pelas regras: só o servidor grava).
 */
export async function consumeDailyQuota(uid: string, feature: string, limit: number): Promise<{ remaining: number }> {
  const day = today();

  if (!account) {
    const key = `${uid}:${feature}`;
    const cur = memoryUsage.get(key);
    const count = cur?.day === day ? cur.count : 0;
    if (count >= limit) throw new HttpError(`Você já usou a IA ${limit} vezes hoje. Volte amanhã!`, 429);
    memoryUsage.set(key, { day, count: count + 1 });
    return { remaining: limit - count - 1 };
  }

  const db = getFirestore(adminApp());
  const ref = db.collection('aiUsage').doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const count = data.day === day ? Number(data[feature] ?? 0) : 0;
    if (count >= limit) throw new HttpError(`Você já usou a IA ${limit} vezes hoje. Volte amanhã!`, 429);
    if (data.day === day) {
      tx.set(ref, { [feature]: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } else {
      // Dia novo: zera todos os contadores
      tx.set(ref, { day, [feature]: 1, updatedAt: FieldValue.serverTimestamp() });
    }
    return { remaining: limit - count - 1 };
  });
}

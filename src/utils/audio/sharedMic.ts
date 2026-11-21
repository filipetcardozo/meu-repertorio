/**
 * Um único microfone para a página inteira.
 *
 * O afinador e o "seguir a voz" precisam do microfone ao mesmo tempo. Se cada um abrir o seu
 * (com configurações diferentes), o Chrome interrompe o reconhecimento de voz. Aqui o microfone
 * é aberto uma vez só e compartilhado (contagem de referências).
 */

type Listener = () => void;

let stream: MediaStream | null = null;
let pending: Promise<MediaStream> | null = null;
let refs = 0;
const listeners = new Set<Listener>();

const notify = () => listeners.forEach((l) => l());

export async function acquireMic(): Promise<MediaStream> {
  refs++;
  if (stream?.active) return stream;
  if (!pending) {
    // Sem cancelamento de eco/supressão/ganho automático: com o cancelamento de eco ligado, o celular
    // entra em "modo de chamada" e o som do app sai no volume de ligação (ignora o volume de mídia).
    // De quebra, o som cru deixa a detecção de nota mais precisa.
    pending = navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    }).then(
      (s) => {
        pending = null;
        stream = s;
        notify();
        return s;
      },
      (e) => {
        pending = null;
        throw e;
      },
    );
  }
  try {
    return await pending;
  } catch (e) {
    refs = Math.max(0, refs - 1);
    throw e;
  }
}

export function releaseMic() {
  refs = Math.max(0, refs - 1);
  if (refs === 0 && stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
    notify();
  }
}

export function getSharedMic(): MediaStream | null {
  return stream;
}

export function subscribeSharedMic(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

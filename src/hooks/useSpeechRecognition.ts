import React from 'react';
import { getSharedMic, subscribeSharedMic } from '../utils/audio/sharedMic';

/**
 * Reconhecimento de voz contínuo com a Web Speech API do navegador (Chrome, Edge, Safari).
 * O Chrome encerra a sessão depois de um silêncio; aqui ela é reiniciada sozinha enquanto estiver ligada.
 *
 * Se o microfone compartilhado estiver aberto (afinador ligado), o reconhecimento usa esse mesmo
 * microfone (`start(track)`, Chrome recente). Sem isso, abrir o microfone em outro lugar
 * interrompe o reconhecimento; nesse caso ele é reiniciado sozinho.
 */

export type SpeechStatus = 'idle' | 'listening' | 'error';

function getRecognitionCtor(): any {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const noopSubscribe = () => () => { };

export function useSpeechSupported(): boolean {
  return React.useSyncExternalStore(noopSubscribe, () => !!getRecognitionCtor(), () => false);
}

/** Falhas seguidas de captura antes de desistir (o microfone pode estar só trocando de dono). */
const MAX_CAPTURE_FAILURES = 8;

const FATAL_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permita o uso do microfone para seguir a voz.',
  'service-not-allowed': 'O navegador bloqueou o reconhecimento de voz.',
  'language-not-supported': 'Português não é suportado por este navegador.',
};

type Options = {
  enabled: boolean;
  lang?: string;
  /** finalText = trecho que acabou de ser confirmado; interimText = o que ainda está sendo ouvido. */
  onResult: (finalText: string, interimText: string) => void;
  onFatalError: (message: string) => void;
};

export function useSpeechRecognition({ enabled, lang = 'pt-BR', onResult, onFatalError }: Options) {
  const [status, setStatus] = React.useState<SpeechStatus>('idle');
  const emitResult = React.useEffectEvent(onResult);
  const emitFatal = React.useEffectEvent(onFatalError);
  const sharedMic = React.useSyncExternalStore(subscribeSharedMic, getSharedMic, () => null);

  React.useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!enabled || !Ctor) return;

    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rec: any = null;
    let trackUnsupported = false;

    const start = () => {
      if (stopped) return;
      rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => setStatus('listening');
      rec.onaudiostart = () => { failures = 0; };
      rec.onresult = (e: any) => {
        let finalText = '';
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const txt: string = r[0]?.transcript ?? '';
          if (r.isFinal) finalText += ' ' + txt;
          else interim += ' ' + txt;
        }
        failures = 0;
        emitResult(finalText.trim(), interim.trim());
      };
      rec.onerror = (e: any) => {
        const msg = FATAL_MESSAGES[e.error];
        if (msg) {
          stopped = true;
          setStatus('error');
          emitFatal(msg);
        } else if (e.error === 'audio-capture') {
          failures++;
          if (failures >= MAX_CAPTURE_FAILURES) {
            stopped = true;
            setStatus('error');
            emitFatal('Não foi possível usar o microfone para seguir a voz.');
          }
        } else if (e.error === 'network') {
          failures++;
        }
      };
      rec.onend = () => {
        rec = null;
        if (stopped) return;
        timer = setTimeout(start, failures ? Math.min(5000, 600 * failures) : 150);
      };

      const track = sharedMic?.getAudioTracks().find((t) => t.readyState === 'live');
      try {
        if (track && !trackUnsupported) {
          try {
            rec.start(track);
          } catch {
            trackUnsupported = true;
            rec.start();
          }
        } else {
          rec.start();
        }
      } catch {
        rec = null;
        failures++;
        timer = setTimeout(start, 600);
      }
    };

    start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      if (rec) {
        rec.onend = null;
        rec.onresult = null;
        try { rec.abort(); } catch { }
      }
      setStatus('idle');
    };
  }, [enabled, lang, sharedMic]);

  return { status: enabled ? status : 'idle' } as const;
}

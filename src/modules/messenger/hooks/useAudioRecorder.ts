import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 5 * 60;
// Chrome/Android gravam em webm; o Safari (iPhone) em mp4.
const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

export interface Recording {
  blob: Blob;
  durationSec: number;
}

/** Gravação de mensagens de voz com o microfone (MediaRecorder). */
export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const resolveRef = useRef<((r: Recording | null) => void) | null>(null);
  const discardRef = useRef(false);

  const isSupported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  const start = useCallback(async (): Promise<boolean> => {
    if (!isSupported || recorderRef.current) return false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return false;
    }
    const mimeType = PREFERRED_TYPES.find(type => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    discardRef.current = false;
    recorder.ondataavailable = event => event.data.size > 0 && chunksRef.current.push(event.data);
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      const durationSec = (Date.now() - startedRef.current) / 1000;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      recorderRef.current = null;
      setIsRecording(false);
      resolveRef.current?.(discardRef.current || durationSec < 0.8 ? null : { blob, durationSec });
      resolveRef.current = null;
    };
    recorderRef.current = recorder;
    startedRef.current = Date.now();
    setSeconds(0);
    setIsRecording(true);
    recorder.start();
    return true;
  }, [isSupported]);

  const finish = useCallback((discard: boolean): Promise<Recording | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return Promise.resolve(null);
    discardRef.current = discard;
    return new Promise(resolve => {
      resolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const stop = useCallback(() => finish(false), [finish]);
  const cancel = useCallback(() => void finish(true), [finish]);

  // Cronómetro e limite de 5 minutos.
  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedRef.current) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) recorderRef.current?.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [isRecording]);

  // Ao sair da página com uma gravação a decorrer, descarta-a.
  useEffect(() => () => void finish(true), [finish]);

  return { isSupported, isRecording, seconds, start, stop, cancel };
};

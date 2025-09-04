import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base64ToArrayBuffer } from '@/vendor/lib/utils';
import { useVoskRecognition } from './use-vosk-recognition';

export type UseMicVoskOptions = {
  enabled?: boolean;
  serviceUrl?: string;
  // 回调
  onPartial?: (text: string) => void;
  onResult?: (text: string) => void;
  onError?: (err: string) => void;
};

export type UseMicVoskResult = {
  // 向 Vosk 发送一段 base64 的 PCM16(16kHz, mono) 音频
  feedBase64: (base64: string) => void;
  // 结束当前话段，触发 Final 结果
  flush: () => void;
  // 当前是否可用
  isReady: boolean;
  // 最近的部分识别
  partialText: string;
  // 启用/停用
  setEnabled: (enabled: boolean) => void;
};

export function useMicVosk({
  enabled = false,
  serviceUrl,
  onPartial,
  onResult,
  onError,
}: UseMicVoskOptions = {}): UseMicVoskResult {
  const [internalEnabled, setInternalEnabled] = useState<boolean>(enabled);
  const [partialText, setPartialText] = useState<string>('');

  const { processAudioData, flush: voskFlush, isReady } = useVoskRecognition({
    enabled: internalEnabled,
    serviceUrl,
    onPartialResult: (t) => {
      setPartialText(t);
      onPartial?.(t);
    },
    onResult: (t) => {
      setPartialText('');
      onResult?.(t);
    },
    onError,
  });

  useEffect(() => {
    setInternalEnabled(enabled);
  }, [enabled]);

  const feedBase64 = useCallback(
    (base64: string) => {
      if (!internalEnabled || !isReady) return;
      try {
        const buffer = base64ToArrayBuffer(base64);
        // 麦克风是 16kHz PCM16 mono
        processAudioData?.(buffer, 16000);
      } catch (e) {
        onError?.(`feedBase64 error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [internalEnabled, isReady, processAudioData, onError]
  );

  const flush = useCallback(() => {
    if (!internalEnabled || !isReady) return;
    voskFlush?.();
  }, [internalEnabled, isReady, voskFlush]);

  return useMemo(
    () => ({ feedBase64, flush, isReady: !!isReady, partialText, setEnabled: setInternalEnabled }),
    [feedBase64, flush, isReady, partialText]
  );
}
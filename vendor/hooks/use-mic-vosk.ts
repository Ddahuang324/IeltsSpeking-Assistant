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
  
  // 音频缓冲队列
  const audioBufferRef = useRef<Array<{ buffer: ArrayBuffer; timestamp: number }>>([]);
  const isProcessingRef = useRef<boolean>(false);
  const maxBufferSize = 50; // 最大缓冲50个音频块
  const bufferTimeout = 5000; // 5秒后清理过期缓冲

  const { processAudioData, flush: voskFlush, isReady, isReconnecting } = useVoskRecognition({
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
  
  // 处理缓冲队列
  const processBufferQueue = useCallback(async () => {
    if (isProcessingRef.current || !isReady || isReconnecting) return;
    
    isProcessingRef.current = true;
    
    try {
      while (audioBufferRef.current.length > 0 && isReady && !isReconnecting) {
        const audioItem = audioBufferRef.current.shift();
        if (!audioItem) break;
        
        // 检查音频数据是否过期（超过5秒）
        if (Date.now() - audioItem.timestamp > bufferTimeout) {
          console.log('🗑️ 丢弃过期音频数据');
          continue;
        }
        
        await processAudioData?.(audioItem.buffer, 16000);
        
        // 添加小延迟避免过快处理
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) {
      console.error('❌ 处理音频缓冲队列错误:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [isReady, isReconnecting, processAudioData]);
  
  // 当网络恢复时处理缓冲队列
  useEffect(() => {
    if (isReady && !isReconnecting && audioBufferRef.current.length > 0) {
      console.log(`🔄 网络恢复，处理缓冲队列 (${audioBufferRef.current.length} 个音频块)`);
      processBufferQueue();
    }
  }, [isReady, isReconnecting, processBufferQueue]);

  useEffect(() => {
    setInternalEnabled(enabled);
  }, [enabled]);

  const feedBase64 = useCallback(
    (base64: string) => {
      if (!internalEnabled) return;
      
      try {
        const buffer = base64ToArrayBuffer(base64);
        
        // 如果服务准备好且没有重连，直接处理
        if (isReady && !isReconnecting && !isProcessingRef.current) {
          processAudioData?.(buffer, 16000);
        } else {
          // 否则加入缓冲队列
          const audioItem = { buffer, timestamp: Date.now() };
          audioBufferRef.current.push(audioItem);
          
          // 限制缓冲队列大小
          if (audioBufferRef.current.length > maxBufferSize) {
            const removed = audioBufferRef.current.shift();
            console.log('🗑️ 缓冲队列已满，丢弃最旧的音频数据');
          }
          
          console.log(`📦 音频数据已缓冲 (队列长度: ${audioBufferRef.current.length})`);
          
          // 如果服务准备好，尝试处理队列
          if (isReady && !isReconnecting) {
            processBufferQueue();
          }
        }
      } catch (e) {
        onError?.(`feedBase64 error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [internalEnabled, isReady, isReconnecting, processAudioData, onError, processBufferQueue]
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
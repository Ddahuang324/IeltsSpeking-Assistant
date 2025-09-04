import { useEffect, useRef, useState, useCallback } from 'react';
import { nanoid } from 'nanoid'

export interface UseVoskRecognitionOptions {
  enabled: boolean;
  serviceUrl?: string;
  onResult?: (text: string) => void;
  onPartialResult?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoskRecognition({
  enabled,
  serviceUrl = 'http://localhost:5001',
  onResult,
  onPartialResult,
  onError,
}: UseVoskRecognitionOptions) {
  console.log('🎤 useVoskRecognition 初始化:', { enabled, serviceUrl });
  console.log('🎤 useVoskRecognition 参数详情:', { 
    enabled, 
    serviceUrl, 
    hasOnResult: !!onResult, 
    hasOnPartialResult: !!onPartialResult, 
    hasOnError: !!onError 
  });
  
  // 强制输出到window.console确保日志可见
  if (typeof window !== 'undefined') {
    window.console.log('🎤 [VOSK] useVoskRecognition 初始化:', { enabled, serviceUrl });
  }
  
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  // 为一次对话（turn）维持一个会话ID，供后端按会话累积识别并在结束时输出 FinalResult
  const sessionIdRef = useRef<string | null>(null);
  const flushingRef = useRef<boolean>(false);
  const ensureSessionId = () => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = nanoid();
      console.log('🆕 [VOSK] 创建新的会话ID:', sessionIdRef.current);
    }
    return sessionIdRef.current;
  }
  
  // 检查 Python 服务健康状态
  const checkServiceHealth = useCallback(async () => {
    if (!enabled) return false;
    
    try {
      console.log('🔍 检查 Python Vosk 服务健康状态...');
      const response = await fetch(`${serviceUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`服务响应错误: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Python Vosk 服务状态:', data);
      
      if (data.status === 'ok' && data.model_loaded) {
        console.log('✅ Python Vosk 服务准备就绪');
        return true;
      } else {
        throw new Error('Python Vosk 服务模型未加载');
      }
    } catch (err) {
      const errorMsg = `Python Vosk 服务连接失败: ${err instanceof Error ? err.message : String(err)}`;
      console.error('❌', errorMsg);
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
      return false;
    }
  }, [enabled, serviceUrl, onError]);
  
  // 初始化服务连接
  const initializeService = useCallback(async () => {
    if (!enabled) return;
    
    try {
      console.log('🎤 开始初始化 Python Vosk 服务连接...');
      setIsLoading(true);
      setError(null);
      
      const isHealthy = await checkServiceHealth();
      
      if (isHealthy) {
        setIsReady(true);
        setIsLoading(false);
        console.log('🚀 Python Vosk 服务初始化完成，准备接收音频数据');
      } else {
        setIsLoading(false);
      }
      
    } catch (err) {
      const errorMsg = `Failed to initialize Python Vosk service: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMsg);
      setIsLoading(false);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [enabled, checkServiceHealth, onError]);
  
  // 处理音频数据
  const processAudioData = useCallback(async (audioData: ArrayBuffer, sampleRate: number = 16000) => {
    console.log('🎤 processAudioData 被调用:', { 
      isReady, 
      bufferSize: audioData.byteLength,
      sampleRate 
    });
    
    if (!isReady) {
      console.log('⚠️ Python Vosk 服务未准备好:', { isReady });
      return;
    }
    const sessionId = ensureSessionId();
    
    try {
      console.log('🎵 处理音频数据:', { dataLength: audioData.byteLength, sampleRate });
      
      // 创建 AudioContext（如果还没有）
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 }); // Vosk模型需要16000Hz
        console.log('🔊 创建 AudioContext，采样率: 16000Hz');
      }
      
      // 将 ArrayBuffer 转换为 Float32Array
      const int16Array = new Int16Array(audioData);
      let float32Array = new Float32Array(int16Array.length);
      
      // 将 Int16 转换为 Float32 (-1.0 到 1.0 范围)
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }
      
      // 如果输入采样率不是16000Hz，需要重采样
      if (sampleRate !== 16000) {
        console.log(`🔄 重采样: ${sampleRate}Hz -> 16000Hz`);
        const targetSampleRate = 16000;
        const resampleRatio = targetSampleRate / sampleRate; // 修复：正确的重采样比例
        const resampledLength = Math.floor(float32Array.length * resampleRatio);
        const resampledArray = new Float32Array(resampledLength);
        
        console.log(`🔧 重采样参数: 比例=${resampleRatio.toFixed(4)}, 原始长度=${float32Array.length}, 目标长度=${resampledLength}`);
        
        // 改进的线性插值重采样
        for (let i = 0; i < resampledLength; i++) {
          const sourceIndex = i / resampleRatio; // 在源数组中的位置
          const index = Math.floor(sourceIndex);
          const fraction = sourceIndex - index;
          
          if (index + 1 < float32Array.length) {
            resampledArray[i] = float32Array[index] * (1 - fraction) + float32Array[index + 1] * fraction;
          } else if (index < float32Array.length) {
            resampledArray[i] = float32Array[index];
          } else {
            resampledArray[i] = 0; // 防止越界
          }
        }
        
        float32Array = resampledArray;
        console.log('🔄 重采样完成:', { 
          originalSamples: int16Array.length, 
          resampledSamples: float32Array.length,
          originalSampleRate: sampleRate,
          targetSampleRate: targetSampleRate,
          resampleRatio: resampleRatio.toFixed(4)
        });
      } else {
         console.log('🔄 音频数据转换完成:', { 
           originalSamples: int16Array.length, 
           convertedSamples: float32Array.length,
           sampleRange: `${Math.min(...Array.from(float32Array))} to ${Math.max(...Array.from(float32Array))}`
         });
      }
      
      // 发送 Float32Array 到 Python Vosk 服务
      console.log('📤 发送音频数据到 Python Vosk 服务');
      
      const response = await fetch(`${serviceUrl}/recognize_stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Session-Id': sessionId,
        },
        body: float32Array.buffer
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('🎤 Python Vosk 识别结果:', result);
      
      if (result.success) {
        if (result.type === 'final' && result.text && result.text.trim()) {
          console.log('🎯 最终识别结果:', result.text);
          if (onResult) {
            onResult(result.text.trim());
          }
          // turn 结束后重置会话，等待下一个 turn
          sessionIdRef.current = null;
        } else if (result.type === 'partial' && result.text && result.text.trim()) {
          console.log('🎤 部分识别结果:', result.text);
          if (onPartialResult) {
            onPartialResult(result.text.trim());
          }
        }
      } else {
        throw new Error(result.error || '识别失败');
      }
      
    } catch (err) {
      const errorMsg = `Audio processing error: ${err instanceof Error ? err.message : String(err)}`;
      console.error('❌ Python Vosk 处理音频数据错误:', err);
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [isReady, serviceUrl, onResult, onPartialResult, onError]);

  // 结束当前会话（一个 turn），触发后端 FinalResult
  const flush = useCallback(async () => {
    if (!isReady) return;
    if (flushingRef.current) return; // 防抖：避免重复触发
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      console.log('ℹ️ [VOSK] 当前无会话需要结束');
      return;
    }
    try {
      console.log('🧹 触发会话结束，获取 FinalResult:', sessionId);
      flushingRef.current = true;
      const resp = await fetch(`${serviceUrl}/recognize_stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Session-Id': sessionId,
          'X-End-Of-Utterance': '1',
        },
        // 允许空body
        body: new Uint8Array(0),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      const res = await resp.json();
      console.log('🧾 会话最终结果:', res);
      if (res?.success && res?.type === 'final' && typeof res.text === 'string') {
        const text = (res.text as string).trim();
        if (text && onResult) onResult(text);
      }
    } catch (e) {
      const msg = `Flush error: ${e instanceof Error ? e.message : String(e)}`;
      console.warn('⚠️ Vosk 会话结束错误:', e);
      if (onError) onError(msg);
    } finally {
      flushingRef.current = false;
      sessionIdRef.current = null; // 下一次 turn 重新生成
    }
  }, [isReady, serviceUrl, onResult, onError]);
  
  // 清理资源
  const cleanup = useCallback(() => {
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // 忽略清理错误
      }
      audioContextRef.current = null;
    }
    
    setIsReady(false);
    setError(null);
    sessionIdRef.current = null;
  }, []);
  
  // 重置识别器
  const resetRecognizer = useCallback(async () => {
    if (!isReady) return;
    
    try {
      console.log('🔄 重置 Python Vosk 识别器...');
      const response = await fetch(`${serviceUrl}/reset`, {
        method: 'POST'
      });
      
      if (response.ok) {
        console.log('✅ Python Vosk 识别器已重置');
      } else {
        console.warn('⚠️ 重置识别器失败');
      }
    } catch (err) {
      console.warn('⚠️ 重置识别器错误:', err);
    }
  }, [isReady, serviceUrl]);
  
  // 初始化效果
  useEffect(() => {
    console.log('🎤 useVoskRecognition useEffect 触发:', { enabled, serviceUrl });
    if (enabled && !isReady && !isLoading) {
      console.log('🎤 开始初始化 Python Vosk 服务');
      initializeService();
    } else if (!enabled) {
      console.log('🎤 Python Vosk 服务已禁用，跳过初始化');
      cleanup();
    }
  
  }, [enabled, serviceUrl, isReady, isLoading, initializeService, cleanup]);
  
  return {
    processAudioData,
    flush,
    isReady,
    error,
  } as const;
}
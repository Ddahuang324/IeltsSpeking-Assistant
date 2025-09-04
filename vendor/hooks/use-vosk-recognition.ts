import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseVoskRecognitionOptions {
  enabled: boolean;
  modelUrl?: string;
  onResult?: (text: string) => void;
  onPartialResult?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoskRecognition({
  enabled,
  modelUrl = '/models/vosk-model-small-en-us-0.15.tar.gz',
  onResult,
  onPartialResult,
  onError,
}: UseVoskRecognitionOptions) {
  console.log('🎤 useVoskRecognition 初始化:', { enabled, modelUrl });
  console.log('🎤 useVoskRecognition 参数详情:', { 
    enabled, 
    modelUrl, 
    hasOnResult: !!onResult, 
    hasOnPartialResult: !!onPartialResult, 
    hasOnError: !!onError 
  });
  
  // 强制输出到window.console确保日志可见
  if (typeof window !== 'undefined') {
    window.console.log('🎤 [VOSK] useVoskRecognition 初始化:', { enabled, modelUrl });
  }
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const modelRef = useRef<any | null>(null);
  const recognizerRef = useRef<any | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // 初始化 Vosk 模型
  const initializeVosk = useCallback(async () => {
    if (!enabled || isReady || isLoading) return;
    
    try {
      console.log('🎤 开始初始化 Vosk 模型...', { enabled, modelUrl });
      setIsLoading(true);
      setError(null);
      
      // 动态导入 vosk-browser
      console.log('📦 开始动态导入 vosk-browser...');
      let createModel;
      try {
        const voskModule = await import('vosk-browser');
        console.log('✅ Vosk 模块加载成功:', voskModule);
        console.log('🔍 模块内容:', Object.keys(voskModule));
        createModel = voskModule.createModel;
        console.log('✅ createModel 函数:', typeof createModel);
        
        if (!createModel) {
          console.log('🔍 尝试从 default 获取 createModel');
          createModel = voskModule.default?.createModel;
          console.log('✅ default.createModel 函数:', typeof createModel);
        }
        
      } catch (importError: any) {
         console.error('❌ 导入 vosk-browser 失败:', importError);
         console.error('❌ 错误详情:', {
           message: importError?.message,
           stack: importError?.stack,
           name: importError?.name
         });
         throw new Error(`Failed to import vosk-browser: ${importError?.message || String(importError)}`);
       }
      
      if (!createModel) {
        throw new Error('createModel 函数不存在');
      }
      
      // 创建模型
      console.log('📥 开始加载模型文件:', modelUrl);
      const model = await createModel(modelUrl);
      console.log('📦 模型对象创建成功:', model);
      console.log('🔍 模型对象方法:', model ? Object.keys(model) : 'model is null');
      modelRef.current = model;
      console.log('🔄 模型创建完成，等待加载...');
      
      // 监听模型加载事件
      model.on('load', (message: any) => {
        console.log('📦 模型加载事件:', message);
        if (message.result) {
          console.log('✅ 模型加载成功，创建识别器...');
          // 创建识别器 (需要传入 sampleRate)
          const recognizer = new model.KaldiRecognizer(16000);
          recognizerRef.current = recognizer;
          console.log('🎯 识别器创建成功');
          
          // 设置识别器事件监听
          recognizer.on('result', (message: any) => {
            console.log('🎤 Vosk 识别结果:', message);
            if (message?.result?.text) {
              const text = message.result.text.trim();
              if (text && onResult) {
                console.log('📝 调用 onResult:', text);
                onResult(text);
              }
            }
          });
          
          recognizer.on('partialresult', (message: any) => {
            console.log('🎤 Vosk 部分结果:', message);
            if (message?.result?.partial) {
              const text = message.result.partial.trim();
              if (text && onPartialResult) {
                console.log('📝 调用 onPartialResult:', text);
                onPartialResult(text);
              }
            }
          });
          
          setIsReady(true);
          setIsLoading(false);
          console.log('🚀 Vosk 初始化完成，准备接收音频数据');
        } else {
          throw new Error('Failed to load Vosk model');
        }
      });
      
      model.on('error', (message: any) => {
        const errorMsg = `Vosk model error: ${message.error || 'Unknown error'}`;
        setError(errorMsg);
        setIsLoading(false);
        if (onError) {
          onError(errorMsg);
        }
      });
      
    } catch (err) {
      const errorMsg = `Failed to initialize Vosk: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMsg);
      setIsLoading(false);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [enabled, modelUrl, onResult, onPartialResult, onError, isReady, isLoading]);
  
  // 处理音频数据
  const processAudioData = useCallback((audioData: ArrayBuffer, sampleRate: number = 16000) => {
    console.log('🎤 processAudioData 被调用:', { 
      hasRecognizer: !!recognizerRef.current, 
      isReady, 
      bufferSize: audioData.byteLength 
    });
    
    if (!isReady || !recognizerRef.current) {
      console.log('⚠️ Vosk 未准备好或识别器不存在:', { isReady, hasRecognizer: !!recognizerRef.current });
      return;
    }
    
    try {
      console.log('🎵 处理音频数据:', { dataLength: audioData.byteLength, sampleRate });
      
      // 创建 AudioContext（如果还没有）
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 }); // Vosk模型需要16000Hz
        console.log('🔊 创建 AudioContext，采样率: 16000Hz');
      }
      
      // 将 ArrayBuffer 转换为 Float32Array（Vosk 需要的格式）
      const int16Array = new Int16Array(audioData);
      let float32Array = new Float32Array(int16Array.length);
      
      // 将 Int16 转换为 Float32 (-1.0 到 1.0 范围)
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }
      
      // 如果输入采样率不是16000Hz，需要重采样
      if (sampleRate !== 16000) {
        console.log(`🔄 重采样: ${sampleRate}Hz -> 16000Hz`);
        const resampleRatio = 16000 / sampleRate;
        const resampledLength = Math.floor(float32Array.length * resampleRatio);
        const resampledArray = new Float32Array(resampledLength);
        
        // 简单的线性插值重采样
        for (let i = 0; i < resampledLength; i++) {
          const sourceIndex = i / resampleRatio;
          const index = Math.floor(sourceIndex);
          const fraction = sourceIndex - index;
          
          if (index + 1 < float32Array.length) {
            resampledArray[i] = float32Array[index] * (1 - fraction) + float32Array[index + 1] * fraction;
          } else {
            resampledArray[i] = float32Array[index];
          }
        }
        
        float32Array = resampledArray;
        console.log('🔄 重采样完成:', { 
          originalSamples: int16Array.length, 
          resampledSamples: float32Array.length,
          originalSampleRate: sampleRate,
          targetSampleRate: 16000
        });
      } else {
         console.log('🔄 音频数据转换完成:', { 
           originalSamples: int16Array.length, 
           convertedSamples: float32Array.length,
           sampleRange: `${Math.min(...Array.from(float32Array))} to ${Math.max(...Array.from(float32Array))}`
         });
      }
      
      // 发送 Float32Array 到 Vosk 识别器
      console.log('📤 发送音频数据到 Vosk 识别器 (Float32Array)');
      const result = recognizerRef.current.acceptWaveformFloat(float32Array, sampleRate);
      console.log('🎤 Vosk acceptWaveform 返回:', result);
      
      if (result) {
        const resultObj = JSON.parse(recognizerRef.current.result());
        console.log('🎯 Vosk 最终结果对象:', resultObj);
        if (resultObj.text) {
          console.log('🎯 Vosk 识别结果:', resultObj.text);
          onResult?.(resultObj.text);
        }
      } else {
        const partialObj = JSON.parse(recognizerRef.current.partialResult());
        console.log('🎤 Vosk 部分结果对象:', partialObj);
        if (partialObj.partial) {
          console.log('🎤 Vosk 部分结果:', partialObj.partial);
          onPartialResult?.(partialObj.partial);
        }
      }
      
    } catch (err) {
      const errorMsg = `Audio processing error: ${err instanceof Error ? err.message : String(err)}`;
      console.error('❌ Vosk 处理音频数据错误:', err);
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [isReady, onError, onResult, onPartialResult]);
  
  // 清理资源
  const cleanup = useCallback(() => {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.remove();
      } catch (e) {
        // 忽略清理错误
      }
      recognizerRef.current = null;
    }
    
    if (modelRef.current) {
      try {
        modelRef.current.terminate();
      } catch (e) {
        // 忽略清理错误
      }
      modelRef.current = null;
    }
    
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
  }, []);
  
  // 初始化效果
  useEffect(() => {
    console.log('🎤 useVoskRecognition useEffect 触发:', { enabled, modelUrl });
    if (enabled) {
      console.log('🎤 开始初始化 Vosk');
      initializeVosk();
    } else {
      console.log('🎤 Vosk 已禁用，跳过初始化');
      cleanup();
    }
    
    return () => {
      console.log('🎤 清理 Vosk 资源');
      cleanup();
    };
  }, [enabled, initializeVosk, cleanup]);
  
  return {
    isLoading,
    isReady,
    error,
    processAudioData,
    cleanup,
  };
}
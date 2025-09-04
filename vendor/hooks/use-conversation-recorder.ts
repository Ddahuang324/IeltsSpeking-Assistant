/**
 * 对话录制Hook - 管理麦克风和API音频的同时录制
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConversationRecorder } from '../lib/conversation-recorder';
import { AudioRecorder } from '../lib/audio-recorder';
import { AudioStreamer } from '../lib/audio-streamer';

export interface UseConversationRecorderOptions {
  micSampleRate?: number;
  apiSampleRate?: number;
  outputSampleRate?: number;
  autoStart?: boolean; // 是否在连接时自动开始录制
}

export interface RecordingUrls {
  micUrl: string;
  apiUrl: string;
  mixedUrl: string;
}

export interface UseConversationRecorderResult {
  isRecording: boolean;
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingUrls | null>;
  error: string | null;
  recordingUrls: RecordingUrls | null;
}

export function useConversationRecorder(
  audioRecorder: AudioRecorder | null,
  audioStreamer: AudioStreamer | null,
  options: UseConversationRecorderOptions = {}
): UseConversationRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordingUrls, setRecordingUrls] = useState<RecordingUrls | null>(null);
  
  const recorderRef = useRef<ConversationRecorder | null>(null);
  const durationIntervalRef = useRef<number | null>(null);

  // API回放时间轴累计（毫秒）
  const apiAccumulatedMsRef = useRef<number>(0);
  const apiStartedRef = useRef<boolean>(false);
  const API_INITIAL_DELAY_MS = 100; // 与AudioStreamer.initialBufferTime保持一致
  
  // 初始化录制器
  useEffect(() => {
    if (!recorderRef.current) {
      recorderRef.current = new ConversationRecorder({
        micSampleRate: options.micSampleRate || 16000,
        apiSampleRate: options.apiSampleRate || 24000,
        outputSampleRate: options.outputSampleRate || 44100
      });
      
      // 监听录制事件
      recorderRef.current.on('recording-started', () => {
        console.log('🎙️ 录制已开始');
        setError(null);
      });
      
      recorderRef.current.on('recording-stopped', (urls: RecordingUrls) => {
        console.log('🎙️ 录制已停止，生成的文件:', urls);
        setRecordingUrls(urls);
      });
    }
    
    return () => {
      if (recorderRef.current) {
        recorderRef.current.dispose();
        recorderRef.current = null;
      }
    };
  }, [options.micSampleRate, options.apiSampleRate, options.outputSampleRate]);
  
  // 设置音频录制器的回调
  useEffect(() => {
    if (audioRecorder && recorderRef.current) {
      const handleMicAudio = (audioData: Float32Array, sampleRate: number) => {
        recorderRef.current?.addMicrophoneAudio(audioData, sampleRate);
      };
      
      audioRecorder.setRecordingCallback(isRecording ? handleMicAudio : null);
    }
    
    return () => {
      if (audioRecorder) {
        audioRecorder.setRecordingCallback(null);
      }
    };
  }, [audioRecorder, isRecording]);
  
  // 设置音频流播放器的回调（使用顺序累计时间轴，避免依赖到达时间导致的加速/重叠）
  useEffect(() => {
    if (audioStreamer && recorderRef.current) {
      const REALIGN_THRESHOLD_MS = 300; // 当发现累计时间比“当前时间+缓冲”落后超过该阈值，认为进入新一轮回复
      const handleApiAudio = (audioData: Float32Array, sampleRate: number) => {
        const chunkDurationMs = (audioData.length / sampleRate) * 1000;
        const nowMs = recorderRef.current?.duration || 0;
        const expectedStartMs = nowMs + API_INITIAL_DELAY_MS;

        if (!apiStartedRef.current) {
          apiAccumulatedMsRef.current = expectedStartMs;
          apiStartedRef.current = true;
        } else if (expectedStartMs - apiAccumulatedMsRef.current > REALIGN_THRESHOLD_MS) {
          // 说明经历了较长的无API音频期（例如用户在说话，模型思考），对齐到当前时间
          apiAccumulatedMsRef.current = expectedStartMs;
        }

        recorderRef.current?.addApiAudioWithTimestamp(audioData, sampleRate, apiAccumulatedMsRef.current);
        apiAccumulatedMsRef.current += chunkDurationMs;
      };
      
      audioStreamer.setRecordingCallback(isRecording ? handleApiAudio : null);
    }
    
    return () => {
      if (audioStreamer) {
        audioStreamer.setRecordingCallback(null);
      }
    };
  }, [audioStreamer, isRecording]);
  
  // 更新录制时长
  useEffect(() => {
    if (isRecording) {
      durationIntervalRef.current = window.setInterval(() => {
        if (recorderRef.current) {
          setDuration(recorderRef.current.duration);
        }
      }, 100);
    } else {
      if (durationIntervalRef.current) {
        window.clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      setDuration(0);
    }
    
    return () => {
      if (durationIntervalRef.current) {
        window.clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [isRecording]);
  
  const startRecording = useCallback(async () => {
    if (!recorderRef.current) {
      setError('录制器未初始化');
      return;
    }
    
    if (isRecording) {
      setError('录制已在进行中');
      return;
    }
    
    try {
      // 重置API时间轴
      apiAccumulatedMsRef.current = 0;
      apiStartedRef.current = false;
      
      await recorderRef.current.startRecording();
      setIsRecording(true);
      setError(null);
      setRecordingUrls(null); // 清除之前的录制结果
    } catch (err) {
      console.error('❌ 开始录制失败:', err);
      setError(err instanceof Error ? err.message : '开始录制失败');
    }
  }, [isRecording]);
  
  const stopRecording = useCallback(async (): Promise<RecordingUrls | null> => {
    if (!recorderRef.current) {
      setError('录制器未初始化');
      return null;
    }
    
    if (!isRecording) {
      setError('当前没有进行录制');
      return null;
    }
    
    try {
      const urls = await recorderRef.current.stopRecording();
      setIsRecording(false);
      setError(null);
      // 停止后重置API累计时间轴
      apiAccumulatedMsRef.current = 0;
      apiStartedRef.current = false;
      return urls;
    } catch (err) {
      console.error('❌ 停止录制失败:', err);
      setError(err instanceof Error ? err.message : '停止录制失败');
      setIsRecording(false);
      return null;
    }
  }, [isRecording]);
  
  return {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    error,
    recordingUrls
  };
}

/**
 * 格式化录制时长为可读字符串
 * @param duration 时长（毫秒）
 * @returns 格式化的时长字符串 (mm:ss)
 */
export function formatDuration(duration: number): string {
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * 下载录制的音频文件
 * @param url 音频文件URL
 * @param filename 文件名
 */
export function downloadRecording(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 清理录制文件URL，释放内存
 * @param urls 录制文件URLs
 */
export function cleanupRecordingUrls(urls: RecordingUrls): void {
  if (urls.micUrl) {
    URL.revokeObjectURL(urls.micUrl);
  }
  if (urls.apiUrl) {
    URL.revokeObjectURL(urls.apiUrl);
  }
  if (urls.mixedUrl) {
    URL.revokeObjectURL(urls.mixedUrl);
  }
}
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useVoskRecognition } from '@/vendor/hooks/use-vosk-recognition';
import { Button, Card, Typography, Space, Alert } from 'antd';

const { Title, Text } = Typography;

export default function TestVoskPage() {
  const [enabled, setEnabled] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[${timestamp}] ${message}`);
  };
  
  const { isLoading, isReady, error, processAudioData } = useVoskRecognition({
    enabled,
    onResult: (text: string) => {
      addLog(`✅ 最终结果: ${text}`);
    },
    onPartialResult: (text: string) => {
      addLog(`🎤 部分结果: ${text}`);
    },
    onError: (error: string) => {
      addLog(`❌ 错误: ${error}`);
    }
  });
  
  useEffect(() => {
    addLog(`Vosk状态更新: isLoading=${isLoading}, isReady=${isReady}, error=${error}`);
  }, [isLoading, isReady, error]);
  
  // 检查麦克风权限
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setHasPermission(result.state === 'granted');
        addLog(`麦克风权限状态: ${result.state}`);
      } catch (error) {
        addLog('无法检查麦克风权限');
      }
    };
    checkPermission();
  }, []);
  
  const handleToggle = () => {
    setEnabled(!enabled);
    addLog(`Vosk ${!enabled ? '启用' : '禁用'}`);
  };
  
  // 请求麦克风权限
  const requestMicrophonePermission = async () => {
    try {
      addLog('请求麦克风权限...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      setHasPermission(true);
      addLog('✅ 麦克风权限获取成功');
      // 立即停止流，只是为了获取权限
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      setHasPermission(false);
      addLog(`❌ 麦克风权限获取失败: ${error}`);
    }
  };
  
  // 开始录音
  const startRecording = async () => {
    if (!hasPermission) {
      await requestMicrophonePermission();
      return;
    }
    
    try {
      addLog('🎤 开始录音...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          addLog(`📦 收到音频数据块: ${event.data.size} bytes`);
        }
      };
      
      mediaRecorder.onstop = async () => {
        addLog('🛑 录音停止，处理音频数据...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        await processRecordedAudio(audioBlob);
      };
      
      mediaRecorder.start(1000); // 每1秒收集一次数据
      setIsRecording(true);
      addLog('✅ 录音已开始');
      
    } catch (error) {
      addLog(`❌ 录音失败: ${error}`);
    }
  };
  
  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      addLog('🛑 停止录音');
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };
  
  // 处理录制的音频
  const processRecordedAudio = async (audioBlob: Blob) => {
    try {
      addLog(`🎵 处理音频文件: ${audioBlob.size} bytes`);
      
      // 将 Blob 转换为 ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      addLog(`📊 音频 ArrayBuffer: ${arrayBuffer.byteLength} bytes`);
      
      // 创建 AudioContext 来解码音频
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      addLog(`🎼 音频解码成功: ${audioBuffer.duration.toFixed(2)}秒, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}声道`);
      
      // 获取音频数据（单声道）
      const channelData = audioBuffer.getChannelData(0);
      addLog(`📈 音频样本数: ${channelData.length}`);
      
      // 转换为 Int16Array (Vosk 期望的格式)
      const int16Array = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        // 将 float32 (-1.0 到 1.0) 转换为 int16 (-32768 到 32767)
        int16Array[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32767));
      }
      
      addLog(`🔄 音频格式转换完成: Int16Array[${int16Array.length}]`);
      
      // 发送到 Vosk
      if (isReady) {
        addLog('📤 发送音频数据到 Vosk...');
        processAudioData(int16Array.buffer, audioBuffer.sampleRate);
      } else {
        addLog('⚠️ Vosk 未准备好，无法处理音频');
      }
      
      await audioContext.close();
      
    } catch (error) {
      addLog(`❌ 音频处理失败: ${error}`);
    }
  };
  
  const testAudioData = () => {
    // 创建一个简单的测试音频数据
    const sampleRate = 16000;
    const duration = 1; // 1秒
    const samples = sampleRate * duration;
    const buffer = new ArrayBuffer(samples * 2); // 16位音频
    const view = new Int16Array(buffer);
    
    // 生成一个简单的正弦波
    for (let i = 0; i < samples; i++) {
      view[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 32767;
    }
    
    addLog('📤 发送测试音频数据到Vosk');
    processAudioData(buffer, sampleRate);
  };

  // 测试 Web Speech API 作为备选方案
  const testWebSpeechAPI = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addLog('❌ 浏览器不支持 Web Speech API');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      addLog('🎤 Web Speech API 开始识别...');
    };
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        addLog(`✅ Web Speech API 最终结果: ${finalTranscript}`);
      }
      if (interimTranscript) {
        addLog(`🔄 Web Speech API 临时结果: ${interimTranscript}`);
      }
    };
    
    recognition.onerror = (event: any) => {
      addLog(`❌ Web Speech API 错误: ${event.error}`);
    };
    
    recognition.onend = () => {
      addLog('🛑 Web Speech API 识别结束');
    };
    
    recognition.start();
    
    // 10秒后自动停止
    setTimeout(() => {
      recognition.stop();
    }, 10000);
  };
  
  const clearLogs = () => {
    setLogs([]);
    console.clear();
  };
  
  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>Vosk 语音识别测试</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="控制面板">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Button 
                type={enabled ? "primary" : "default"}
                onClick={handleToggle}
              >
                {enabled ? '禁用 Vosk' : '启用 Vosk'}
              </Button>
              
              <Button 
                 onClick={testAudioData}
                 disabled={!isReady}
               >
                 测试音频数据
               </Button>
               
               <Button 
                 onClick={testWebSpeechAPI}
               >
                 测试 Web Speech API
               </Button>
               
               <Button 
                 onClick={clearLogs}
               >
                 清空日志
               </Button>
             </Space>
            
            <Space>
              {hasPermission === null && (
                <Button onClick={requestMicrophonePermission}>
                  检查麦克风权限
                </Button>
              )}
              
              {hasPermission === false && (
                <Button type="primary" onClick={requestMicrophonePermission}>
                  请求麦克风权限
                </Button>
              )}
              
              {hasPermission === true && (
                <>
                  <Button 
                     type="primary"
                     danger={isRecording}
                     onClick={isRecording ? stopRecording : startRecording}
                     disabled={!isReady}
                   >
                     {isRecording ? '🛑 停止录音' : '🎤 开始录音'}
                   </Button>
                </>
              )}
            </Space>
          </Space>
        </Card>
        
        <Card title="状态信息">
          <Space direction="vertical">
            <Text>Vosk启用状态: {enabled ? '✅ 已启用' : '❌ 已禁用'}</Text>
            <Text>Vosk加载状态: {isLoading ? '🔄 加载中...' : '✅ 加载完成'}</Text>
            <Text>Vosk准备状态: {isReady ? '✅ 已准备' : '❌ 未准备'}</Text>
            <Text>麦克风权限: {
              hasPermission === null ? '🔍 检查中...' :
              hasPermission ? '✅ 已授权' : '❌ 未授权'
            }</Text>
            <Text>录音状态: {isRecording ? '🎤 录音中...' : '⏹️ 已停止'}</Text>
            {error && <Alert message={error} type="error" />}
          </Space>
        </Card>
        
        <Card title="日志输出" style={{ height: '400px', overflow: 'auto' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
            {logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '4px' }}>
                {log}
              </div>
            ))}
          </div>
        </Card>
      </Space>
    </div>
  );
}
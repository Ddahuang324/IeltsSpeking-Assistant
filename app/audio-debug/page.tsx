'use client';

import { useState, useRef, useCallback } from 'react';
import { Button, Card, Typography, Space, Alert, Divider } from 'antd';

const { Title, Text } = Typography;

interface AudioDebugInfo {
  originalSize: number;
  sampleRate: number;
  channels: number;
  duration: number;
  format: string;
  dataType: string;
  minValue: number;
  maxValue: number;
  avgValue: number;
}

export default function AudioDebugPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [debugInfo, setDebugInfo] = useState<AudioDebugInfo | null>(null);
  const [voskResult, setVoskResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const analyzeAudioData = useCallback((audioBuffer: ArrayBuffer): AudioDebugInfo => {
    // 尝试不同的数据类型解析
    const int16Array = new Int16Array(audioBuffer);
    const float32Array = new Float32Array(audioBuffer);
    const uint8Array = new Uint8Array(audioBuffer);
    
    // 分析Int16数据
    const int16Values = Array.from(int16Array);
    const int16Min = Math.min(...int16Values);
    const int16Max = Math.max(...int16Values);
    const int16Avg = int16Values.reduce((a, b) => a + b, 0) / int16Values.length;
    
    // 分析Float32数据
    const float32Values = Array.from(float32Array);
    const float32Min = Math.min(...float32Values);
    const float32Max = Math.max(...float32Values);
    const float32Avg = float32Values.reduce((a, b) => a + b, 0) / float32Values.length;
    
    // 判断数据类型
    let dataType = 'unknown';
    let minValue = 0, maxValue = 0, avgValue = 0;
    
    if (float32Min >= -1.0 && float32Max <= 1.0) {
      dataType = 'Float32 (-1.0 to 1.0)';
      minValue = float32Min;
      maxValue = float32Max;
      avgValue = float32Avg;
    } else if (int16Min >= -32768 && int16Max <= 32767) {
      dataType = 'Int16 (-32768 to 32767)';
      minValue = int16Min;
      maxValue = int16Max;
      avgValue = int16Avg;
    } else {
      dataType = 'Raw bytes';
      minValue = Math.min(...Array.from(uint8Array));
      maxValue = Math.max(...Array.from(uint8Array));
      avgValue = Array.from(uint8Array).reduce((a, b) => a + b, 0) / uint8Array.length;
    }
    
    return {
      originalSize: audioBuffer.byteLength,
      sampleRate: 0, // 无法从原始数据确定
      channels: 1, // 假设单声道
      duration: 0, // 无法从原始数据确定
      format: 'PCM',
      dataType,
      minValue,
      maxValue,
      avgValue
    };
  }, []);

  const sendToVosk = useCallback(async (audioData: ArrayBuffer, sampleRate: number = 16000) => {
    try {
      console.log('🎤 发送音频数据到Vosk:', { 
        size: audioData.byteLength, 
        sampleRate 
      });
      
      // 转换为Float32Array（模拟前端处理）
      const int16Array = new Int16Array(audioData);
      const float32Array = new Float32Array(int16Array.length);
      
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }
      
      const response = await fetch('http://localhost:5001/recognize_stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: float32Array.buffer
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('🎤 Vosk结果:', result);
      
      if (result.success) {
        setVoskResult(prev => prev + ' ' + (result.text || ''));
      } else {
        setError(`Vosk错误: ${result.error}`);
      }
    } catch (err) {
      console.error('❌ Vosk请求失败:', err);
      setError(`Vosk请求失败: ${err}`);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=pcm'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        // 分析音频数据
        const info = analyzeAudioData(arrayBuffer);
        setDebugInfo(info);
        
        // 发送到Vosk
        await sendToVosk(arrayBuffer, 16000);
        
        // 停止所有音频轨道
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setError('');
      setVoskResult('');
      
    } catch (err) {
      console.error('❌ 录音启动失败:', err);
      setError(`录音启动失败: ${err}`);
    }
  }, [analyzeAudioData, sendToVosk]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const testVoskHealth = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5001/health');
      const result = await response.json();
      console.log('🏥 Vosk健康检查:', result);
      setError(result.status === 'healthy' ? '' : 'Vosk服务不健康');
    } catch (err) {
      console.error('❌ Vosk健康检查失败:', err);
      setError(`Vosk健康检查失败: ${err}`);
    }
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="音频格式调试工具">
          <Space size="middle">
            <Button 
              onClick={testVoskHealth}
              type="default"
            >
              测试Vosk健康状态
            </Button>
            
            <Button 
              onClick={isRecording ? stopRecording : startRecording}
              type={isRecording ? "primary" : "default"}
              danger={isRecording}
            >
              {isRecording ? '停止录音' : '开始录音'}
            </Button>
          </Space>
          
          {error && (
            <Alert
              message="错误"
              description={error}
              type="error"
              style={{ marginTop: '16px' }}
            />
          )}
        </Card>
          
        {debugInfo && (
          <Card title="音频数据分析">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Text>原始大小: {debugInfo.originalSize} bytes</Text>
                <Text>数据类型: {debugInfo.dataType}</Text>
                <Text>最小值: {debugInfo.minValue.toFixed(6)}</Text>
                <Text>最大值: {debugInfo.maxValue.toFixed(6)}</Text>
                <Text>平均值: {debugInfo.avgValue.toFixed(6)}</Text>
                <Text>格式: {debugInfo.format}</Text>
              </div>
            </Space>
          </Card>
        )}
        
        {voskResult && (
          <Card title="Vosk识别结果">
            <Alert
              message="识别结果"
              description={voskResult}
              type="success"
            />
          </Card>
        )}
      </Space>
    </div>
  );
}
/**
 * 对话录制器 - 同时录制麦克风输入和API音频输出
 * 支持生成时间同步的MP3文件
 */

import EventEmitter from "eventemitter3";
import { audioContext } from "./utils";

export interface AudioChunk {
  data: Float32Array;
  timestamp: number; // 距离录制开始的毫秒数
  source: 'microphone' | 'api';
  sampleRate: number;
}

export interface RecordingOptions {
  micSampleRate?: number;
  apiSampleRate?: number;
  outputSampleRate?: number;
}

export interface RecordingUrls {
  micUrl: string;
  apiUrl: string;
  mixedUrl: string;
}

export class ConversationRecorder extends EventEmitter {
  private isRecording = false;
  private startTime = 0;
  private micAudioChunks: AudioChunk[] = [];
  private apiAudioChunks: AudioChunk[] = [];
  private micStream: MediaStream | null = null;
  private micAudioContext: AudioContext | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  private options: Required<RecordingOptions>;

  constructor(options: RecordingOptions = {}) {
    super();
    this.options = {
      micSampleRate: options.micSampleRate || 16000,
      apiSampleRate: options.apiSampleRate || 24000,
      outputSampleRate: options.outputSampleRate || 44100
    };
  }

  /**
   * 开始录制对话
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('录制已在进行中');
    }

    try {
      // 清空之前的录制数据
      this.micAudioChunks = [];
      this.apiAudioChunks = [];
      this.startTime = Date.now();
      
      // 初始化麦克风录制
      await this.initMicrophoneRecording();
      
      this.isRecording = true;
      this.emit('recording-started');
      
      console.log('🎙️ 对话录制已开始');
    } catch (error) {
      console.error('❌ 启动录制失败:', error);
      throw error;
    }
  }

  /**
   * 停止录制并生成音频文件
   */
  async stopRecording(): Promise<RecordingUrls> {
    if (!this.isRecording) {
      throw new Error('当前没有进行录制');
    }

    this.isRecording = false;
    
    // 停止麦克风录制
    this.stopMicrophoneRecording();
    
    console.log('🎙️ 对话录制已停止');
    console.log(`📊 录制统计: 麦克风片段 ${this.micAudioChunks.length}, API片段 ${this.apiAudioChunks.length}`);
    
    // 生成音频文件
    const urls = await this.generateAudioFiles();
    
    this.emit('recording-stopped', urls);
    return urls;
  }

  /**
   * 添加麦克风音频数据（按捕获时间写入时间轴）
   */
  addMicrophoneAudio(audioData: Float32Array, sampleRate: number = this.options.micSampleRate): void {
    if (!this.isRecording) return;
    
    const chunk: AudioChunk = {
      data: new Float32Array(audioData),
      timestamp: Date.now() - this.startTime,
      source: 'microphone',
      sampleRate
    };
    
    this.micAudioChunks.push(chunk);
  }

  /**
   * 添加API音频数据（使用捕获时间作为时间戳）
   * 注意：如果可用，请优先使用 addApiAudioWithTimestamp 传入实际播放的调度时间
   */
  addApiAudio(audioData: Float32Array, sampleRate: number = this.options.apiSampleRate): void {
    if (!this.isRecording) return;
    
    const chunk: AudioChunk = {
      data: new Float32Array(audioData),
      timestamp: Date.now() - this.startTime,
      source: 'api',
      sampleRate
    };
    
    this.apiAudioChunks.push(chunk);
  }

  /**
   * 添加API音频数据（使用实际播放调度时间的时间戳，毫秒）
   */
  addApiAudioWithTimestamp(audioData: Float32Array, sampleRate: number, timestampMs: number): void {
    if (!this.isRecording) return;

    const ts = Math.max(0, timestampMs); // 不允许负数
    const chunk: AudioChunk = {
      data: new Float32Array(audioData),
      timestamp: ts,
      source: 'api',
      sampleRate
    };

    this.apiAudioChunks.push(chunk);
  }

  /**
   * 初始化麦克风录制
   */
  private async initMicrophoneRecording(): Promise<void> {
    try {
      // 获取麦克风权限
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.micSampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // 创建音频上下文
      this.micAudioContext = await audioContext({ sampleRate: this.options.micSampleRate });
      this.micSource = this.micAudioContext.createMediaStreamSource(this.micStream);
      
      // 创建音频处理器
      this.micProcessor = this.micAudioContext.createScriptProcessor(4096, 1, 1);
      
      this.micProcessor.onaudioprocess = (event) => {
        if (!this.isRecording) return;
        
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // 添加到录制缓冲区
        this.addMicrophoneAudio(inputData, this.options.micSampleRate);
      };
      
      // 连接音频节点
      this.micSource.connect(this.micProcessor);
      this.micProcessor.connect(this.micAudioContext.destination);
      
    } catch (error) {
      console.error('❌ 初始化麦克风录制失败:', error);
      throw error;
    }
  }

  /**
   * 停止麦克风录制
   */
  private stopMicrophoneRecording(): void {
    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor = null;
    }
    
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    
    if (this.micAudioContext) {
      this.micAudioContext.close();
      this.micAudioContext = null;
    }
  }

  /**
   * 生成音频文件
   */
  private async generateAudioFiles(): Promise<RecordingUrls> {
    const outputSampleRate = this.options.outputSampleRate;
    
    // 生成单独的音频文件（注意：保持与全局开始时间对齐，不再对齐到各自首块）
    const micBuffer = this.createAudioBuffer(this.micAudioChunks, outputSampleRate);
    const apiBuffer = this.createAudioBuffer(this.apiAudioChunks, outputSampleRate);
    
    // 生成混合音频文件（同一时间轴上逐样本混合）
    const mixedBuffer = this.mixAudioBuffers(micBuffer, apiBuffer, outputSampleRate);
    
    // 转换为WAV格式并创建URL
    const micUrl = this.createAudioUrl(micBuffer, outputSampleRate);
    const apiUrl = this.createAudioUrl(apiBuffer, outputSampleRate);
    const mixedUrl = this.createAudioUrl(mixedBuffer, outputSampleRate);
    
    return { micUrl, apiUrl, mixedUrl };
  }

  /**
   * 创建时间同步的音频缓冲区
   * 使用“录制开始”为零点的全局时间轴
   */
  private createAudioBuffer(chunks: AudioChunk[], targetSampleRate: number): Float32Array {
    if (chunks.length === 0) {
      console.log(`⚠️ 没有音频数据`);
      return new Float32Array(0);
    }
    
    // 按时间戳排序（毫秒）
    const sortedChunks = chunks.sort((a, b) => a.timestamp - b.timestamp);
    
    // 计算录制总时长（毫秒），以“最后一块的结束时间”为准
    let endTimeMs = 0;
    for (const c of sortedChunks) {
      const cEnd = c.timestamp + (c.data.length / c.sampleRate) * 1000;
      if (cEnd > endTimeMs) endTimeMs = cEnd;
    }
    const durationSec = Math.max(endTimeMs / 1000, 0.1); // 至少0.1秒
    
    // 计算输出缓冲区大小
    const totalSamples = Math.ceil(durationSec * targetSampleRate);
    const buffer = new Float32Array(totalSamples);
    
    console.log(`📊 音频处理: ${sortedChunks.length} 块, 时长 ${durationSec.toFixed(2)}s, 输出样本 ${totalSamples}`);
    
    // 将每个音频片段放置到全局时间轴的正确位置
    for (const chunk of sortedChunks) {
      const relativeTimeSec = Math.max(0, chunk.timestamp / 1000); // 相对全局零点（秒）
      const startSample = Math.floor(relativeTimeSec * targetSampleRate);
      
      // 重采样音频数据到输出采样率
      const resampledData = this.resampleAudio(chunk.data, chunk.sampleRate, targetSampleRate);
      
      // 确保不超出缓冲区边界
      const endSample = Math.min(startSample + resampledData.length, totalSamples);
      const copyLength = endSample - startSample;
      
      if (copyLength > 0) {
        // 混合音频（如果有重叠）
        for (let i = 0; i < copyLength; i++) {
          buffer[startSample + i] += resampledData[i];
        }
      }
    }
    
    // 标准化音频以防止削波
    this.normalizeAudio(buffer);
    
    return buffer;
  }

  /**
   * 混合两个音频缓冲区
   */
  private mixAudioBuffers(buffer1: Float32Array, buffer2: Float32Array, sampleRate: number): Float32Array {
    const maxLength = Math.max(buffer1.length, buffer2.length);
    const mixedBuffer = new Float32Array(maxLength);
    
    // 计算音频能量以调整混合比例
    const micEnergy = this.calculateRMS(buffer1);
    const apiEnergy = this.calculateRMS(buffer2);
    
    // 动态调整混合比例，确保两个声道都清晰可听
    let micGain = 0.7;
    let apiGain = 0.7;
    
    if (micEnergy > 0 && apiEnergy > 0) {
      const energyRatio = micEnergy / apiEnergy;
      if (energyRatio > 2) {
        // 麦克风音量较大，降低其增益
        micGain = 0.5;
        apiGain = 0.8;
      } else if (energyRatio < 0.5) {
        // API音频较大，降低其增益
        micGain = 0.8;
        apiGain = 0.5;
      }
    }
    
    for (let i = 0; i < maxLength; i++) {
      const sample1 = i < buffer1.length ? buffer1[i] * micGain : 0;
      const sample2 = i < buffer2.length ? buffer2[i] * apiGain : 0;
      
      // 混合音频
      mixedBuffer[i] = sample1 + sample2;
    }
    
    // 标准化混合后的音频
    this.normalizeAudio(mixedBuffer);
    
    console.log(`📊 混合音频: 麦克风增益=${micGain.toFixed(2)}, API增益=${apiGain.toFixed(2)}, 样本=${maxLength}`);
    return mixedBuffer;
  }

  /**
   * 重采样音频数据（使用线性插值）
   */
  private resampleAudio(inputData: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
    if (inputSampleRate === outputSampleRate) {
      return inputData;
    }
    
    const ratio = outputSampleRate / inputSampleRate;
    const outputLength = Math.floor(inputData.length * ratio);
    const outputData = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      const inputIndex = i / ratio;
      const inputIndexFloor = Math.floor(inputIndex);
      const inputIndexCeil = Math.min(inputIndexFloor + 1, inputData.length - 1);
      const fraction = inputIndex - inputIndexFloor;
      
      // 线性插值
      outputData[i] = inputData[inputIndexFloor] * (1 - fraction) + inputData[inputIndexCeil] * fraction;
    }
    
    return outputData;
  }
  
  /**
   * 计算音频的RMS（均方根）能量
   */
  private calculateRMS(buffer: Float32Array): number {
    if (buffer.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    
    return Math.sqrt(sum / buffer.length);
  }
  
  /**
   * 标准化音频以防止削波
   */
  private normalizeAudio(buffer: Float32Array): void {
    if (buffer.length === 0) return;
    
    // 找到最大绝对值
    let maxValue = 0;
    for (let i = 0; i < buffer.length; i++) {
      maxValue = Math.max(maxValue, Math.abs(buffer[i]));
    }
    
    // 如果音频过大，进行标准化
    if (maxValue > 0.95) {
      const scale = 0.95 / maxValue;
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] *= scale;
      }
      console.log(`🔧 音频标准化: 缩放比例 ${scale.toFixed(3)}`);
    }
  }

  /**
   * 创建音频URL
   */
  private createAudioUrl(audioBuffer: Float32Array, sampleRate: number): string {
    const wavBuffer = this.encodeWAV(audioBuffer, sampleRate);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  /**
   * 编码为WAV格式
   */
  private encodeWAV(audioBuffer: Float32Array, sampleRate: number): ArrayBuffer {
    const length = audioBuffer.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV文件头
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    // RIFF头
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true); // 文件大小
    writeString(8, 'WAVE');
    
    // fmt块
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt块大小
    view.setUint16(20, 1, true); // 音频格式 (PCM)
    view.setUint16(22, 1, true); // 声道数 (单声道)
    view.setUint32(24, sampleRate, true); // 采样率
    view.setUint32(28, sampleRate * 2, true); // 字节率
    view.setUint16(32, 2, true); // 块对齐
    view.setUint16(34, 16, true); // 位深度
    
    // data块
    writeString(36, 'data');
    view.setUint32(40, length * 2, true); // 数据大小
    
    // 转换为16位PCM数据
    let offset = 44;
    for (let i = 0; i < length; i++) {
      // 限制范围并转换为16位整数
      const sample = Math.max(-1, Math.min(1, audioBuffer[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return buffer;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.isRecording) {
      this.stopMicrophoneRecording();
    }
    
    this.micAudioChunks = [];
    this.apiAudioChunks = [];
    this.removeAllListeners();
  }

  /**
   * 获取录制状态
   */
  get recording(): boolean {
    return this.isRecording;
  }

  /**
   * 获取录制时长（毫秒）
   */
  get duration(): number {
    return this.isRecording ? Date.now() - this.startTime : 0;
  }
}
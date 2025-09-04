/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MultimodalLiveAPIClientConnection,
  MultimodalLiveClient,
} from "../lib/multimodal-live-client";
import { LiveConfig, LiveOutgoingMessage, ServerContentMessage, RealtimeInputMessage, ClientContentMessage, ModelTurn, ServerContent } from "../multimodal-live-types";
import { AudioStreamer } from "../lib/audio-streamer";
import { audioContext } from "../lib/utils";
import VolMeterWorket from "../lib/worklets/vol-meter";
import { GenerativeContentBlob, Part } from "@google/generative-ai";
import { nanoid } from 'nanoid'
import { useVoskRecognition } from './use-vosk-recognition';


export type UseLiveAPIResults = {
  client: MultimodalLiveClient;
  setConfig: (config: LiveConfig) => void;
  config: LiveConfig;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
  currentUserMessage: RealtimeInputMessage | ClientContentMessage | null;
  currentBotMessage: ServerContentMessage | null;
  currentTranscriptMessage: ServerContentMessage | null;
  setOutputMode: (mode: string) => void;
  transcribedText: string;
  setSpeechToTextEnabled: (enabled: boolean) => void;
};

export function useLiveAPI({
  url,
  apiKey,
}: MultimodalLiveAPIClientConnection): UseLiveAPIResults {
  const client = useMemo(
    () => new MultimodalLiveClient({ url, apiKey }),
    [url, apiKey],
  );
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConfig>({
    model: "models/gemini-live-2.5-flash-preview",
  });
  const [volume, setVolume] = useState(0);
  const [outputMode, setOutputMode] = useState<string>('audio');
  const [speechToTextEnabled, setSpeechToTextEnabled] = useState<boolean>(true);
  // current message
  const [currentUserMessage, setCurrentUserMessage] = useState<RealtimeInputMessage | ClientContentMessage | null>(null);
  const [currentBotMessage, setCurrentBotMessage] = useState<ServerContentMessage | null>(null);
  const [currentTranscriptMessage, setCurrentTranscriptMessage] = useState<ServerContentMessage | null>(null);
  // 转写文本状态
  const [transcribedText, setTranscribedText] = useState<string>('');
  // Vosk语音识别
  console.log('🔧 useLiveAPI - Vosk配置:', { 
    outputMode, 
    speechToTextEnabled, 
    enabled: outputMode === 'audio_text' && speechToTextEnabled 
  });
  
  const { processAudioData, flush, isReady, error } = useVoskRecognition({
    enabled: outputMode === 'audio_text' && speechToTextEnabled,
    onResult: (text: string) => {
      console.log('🎯 Vosk 最终结果:', text);
      setTranscribedText(text); // 直接设置，不累积
      // 将最终转写结果作为一条 ServerContentMessage 推入，便于在聊天历史中记录
      setCurrentTranscriptMessage({
        serverContent: {
          modelTurn: {
            parts: [{ text }],
          },
        },
        id: nanoid(),
      });
    },
    onPartialResult: (text: string) => {
      console.log('🎤 Vosk 部分结果:', text);
      setTranscribedText(text); // 显示部分结果
    },
    onError: (error: string) => {
      console.error('❌ Vosk 错误:', error);
    }
  });
  
  console.log('🔧 useLiveAPI - Vosk状态:', { isReady, error, hasProcessAudioData: !!processAudioData });
  // 服务端返回的语音，一方面直接播放，另一方面需要保存起来，结束的时候，生成一个播放地址
  const botAudioParts = useRef<Part[]>([]);
  const botContentParts = useRef<Part[]>([]);
  // 用户输入的语音/图片需要保存起来，结束的时候生成语音/视频？
  const mediaChunks = useRef<GenerativeContentBlob[]>([]);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>("vumeter-out", VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          });
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onClose = () => {
      setConnected(false);
    };

    const stopAudioStreamer = () => audioStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) => {
      if (outputMode !== 'text') {
        if (outputMode === 'audio') {
          audioStreamerRef.current?.addPCM16(new Uint8Array(data));
        } else if (outputMode === 'audio_text') {
          // Audio+Text模式：播放音频并进行语音转文字
          console.log('🔊 Audio+Text模式 - 播放音频:', { dataLength: data.byteLength });
          audioStreamerRef.current?.addPCM16(new Uint8Array(data));
          // 将PCM16音频数据发送给Vosk进行转写（仅在启用时）
          console.log('🎤 检查Vosk状态:', { isReady, speechToTextEnabled, outputMode });
          if (isReady && speechToTextEnabled) {
            console.log('📤 发送音频数据给Vosk，使用24000Hz采样率');
            // Gemini返回的音频采样率是24000Hz，需要传递给Vosk
            processAudioData(data, 24000);
          } else {
            console.log('⚠️ Vosk未准备好或已禁用');
          }
        }
      }
    }

    client
      .on("close", onClose)
      .on("interrupted", stopAudioStreamer)
      .on("audio", onAudio);

    return () => {
      client
        .off("close", onClose)
        .off("interrupted", stopAudioStreamer)
        .off("audio", onAudio);
    };
  }, [client, outputMode, isReady, processAudioData, speechToTextEnabled]);

  useEffect(() => {
    let currnetBotMessageId: string = nanoid()
    let currnetUserMessageId: string = nanoid()
    // const onAudio = (data: ArrayBuffer) => {
    //   // 保存结果到botAudioBuffers
    //   botAudioBuffers.current?.push(data)
    // }
    const onAudioContent = (data: ModelTurn['modelTurn']['parts']) => {
      // 保存结果到botAudioParts
      botAudioParts.current = [...botAudioParts.current, ...data]
    }
    const onInput = (data: RealtimeInputMessage | ClientContentMessage) => {
      if ((data as RealtimeInputMessage)?.realtimeInput?.mediaChunks) {
        mediaChunks.current?.push(...(data as RealtimeInputMessage)?.realtimeInput?.mediaChunks)
      }
      if ((data as ClientContentMessage)?.clientContent) {
        // 用户输入了就会有一个turnComplete，立即结束
        setCurrentUserMessage({
          ...data,
          id: currnetUserMessageId,
          // 先不处理输入的语音消息
          // realtimeInput: {
          //   mediaChunks: mediaChunks?.current ?? [],
          // }
        })
        currnetUserMessageId = nanoid()  // 生成一个新的id
        mediaChunks.current = []  // 清空mediaChunks
      }
    }
    const onContent = (content: ModelTurn) => {
      // 文本输出，将文本放到bot message里面
      if (content.modelTurn?.parts) {
        botContentParts.current.push(...content.modelTurn?.parts)  
        // 这里需要先设置文本消息，支持实时的打字机效果
        setCurrentBotMessage({
          serverContent: {
            modelTurn: {
              // 这里只有文本消息，语音消息只在最后收到turncomplete的时候再一次性发过去
              parts: botContentParts.current,
            }
          },
          id: currnetBotMessageId,
        })
      }
		}
		const onInterrupted = () => {
			// 这个事件应该表示的是，机器人的语音消息被打断？实际上应该算用户语音输入开始
			console.log('onInterrupted')
			// if (buffers.length) {
			// 	new Blob(buffers).arrayBuffer().then((buffer: ArrayBuffer) => {
			// 		const blob = pcmBufferToBlob(buffer);
			// 		const audioUrl = URL.createObjectURL(blob);
			// 		const message = { audioUrl }
			// 		setMessages((state: any) => {
			// 			console.log('new message', state, message)
			// 			return [...state, message]
			// 		})
			// 	})
			// }
		}
		const onTurnComplete = () => {
			// 这个事件表示机器人生成的消息结束了，不管是文本结束还是语音结束，都有这个消息
			console.log('onTurnComplete')
			if (botContentParts.current?.length || botAudioParts.current?.length) {
        setCurrentBotMessage({
          serverContent: {
            modelTurn: {
              // 文本消息加上语音消息
              parts: [...botContentParts.current, ...botAudioParts.current],
            }
          },
          id: currnetBotMessageId,
        })
        currnetBotMessageId = nanoid()
        botContentParts.current = []; // 清空数据
        botAudioParts.current = [];
			}
      // 当本轮对话的音频输出结束时，触发一次Vosk flush，获取最终转写结果
      if (speechToTextEnabled && isReady) {
        try {
          flush();
        } catch (e) {
          console.warn('flush 调用失败', e);
        }
      }
		}
    client
      .on('interrupted', onInterrupted)
      .on('turncomplete', onTurnComplete)
      .on('content', onContent)
      .on('input', onInput)
      .on('audiocontent', onAudioContent);
    return () => {
      client
        .off('interrupted', onInterrupted)
        .off('turncomplete', onTurnComplete)
        .off('content', onContent)
        .off('input', onInput)
        .off('audiocontent', onAudioContent);
    }
  }, [client, flush, isReady, speechToTextEnabled])

  const connect = useCallback(async () => {
    console.log(config);
    if (!config) {
      throw new Error("config has not been set");
    }
    client.disconnect();
    try {
      await client.connect(config);
      setConnected(true);
      // 清空之前的转录文本与临时转写消息
      setTranscribedText('');
      setCurrentTranscriptMessage(null);
    } catch (err: any) {
      // 将错误抛出给调用方（页面）以便弹窗提示
      console.error('connect failed:', err);
      setConnected(false);
      throw err;
    }
  }, [client, setConnected, config]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
  }, [setConnected, client]);

  const setOutputModeCallback = useCallback((mode: string) => {
    setOutputMode(mode);
  }, []);

  return {
    client,
    config,
    setConfig,
    connected,
    connect,
    disconnect,
    volume,
    currentUserMessage,
    currentBotMessage,
    currentTranscriptMessage,
    setOutputMode: setOutputModeCallback,
    transcribedText,
    setSpeechToTextEnabled,
  };
}

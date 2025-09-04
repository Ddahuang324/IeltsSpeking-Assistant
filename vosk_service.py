#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vosk 语音识别服务
提供 HTTP API 接口供前端调用
"""

import json
import os
import wave
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import vosk
import numpy as np
import threading

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 全局变量
model = None
rec = None
recognizers = {}
# 为每个会话提供互斥锁，避免并发请求对同一识别器造成竞态
session_locks = {}
# 标记会话是否已结束（flush），用于忽略迟到的音频块
session_closed = set()
request_count = 0  # 请求计数器，用于定期重置识别器

# 模型路径
MODEL_PATH = "./public/models/vosk-model-small-en-us-0.15"

def init_vosk_model():
    """初始化 Vosk 模型"""
    global model, rec
    
    if not os.path.exists(MODEL_PATH):
        print(f"错误: 模型路径不存在: {MODEL_PATH}")
        print("请确保模型文件已解压到正确位置")
        return False
    
    try:
        print(f"正在加载 Vosk 模型: {MODEL_PATH}")
        model = vosk.Model(MODEL_PATH)
        rec = vosk.KaldiRecognizer(model, 16000)  # 16kHz 采样率
        print("Vosk 模型加载成功")
        return True
    except Exception as e:
        print(f"加载 Vosk 模型失败: {e}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None
    })

@app.route('/recognize', methods=['POST'])
def recognize_audio():
    """语音识别接口"""
    global rec
    
    if not model or not rec:
        return jsonify({
            'error': 'Vosk 模型未初始化',
            'success': False
        }), 500
    
    try:
        # 获取音频数据
        if 'audio' not in request.files:
            return jsonify({
                'error': '未找到音频文件',
                'success': False
            }), 400
        
        audio_file = request.files['audio']
        
        # 保存临时文件
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
            audio_file.save(tmp_file.name)
            
            # 读取 WAV 文件
            with wave.open(tmp_file.name, 'rb') as wf:
                # 检查音频格式
                if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
                    return jsonify({
                        'error': f'音频格式不支持。需要: 单声道, 16位, 16kHz。当前: {wf.getnchannels()}声道, {wf.getsampwidth()*8}位, {wf.getframerate()}Hz',
                        'success': False
                    }), 400
                
                # 读取音频数据
                audio_data = wf.readframes(wf.getnframes())
        
        # 删除临时文件
        os.unlink(tmp_file.name)
        
        # 进行语音识别
        if rec.AcceptWaveform(audio_data):
            result = json.loads(rec.Result())
            return jsonify({
                'text': result.get('text', ''),
                'confidence': result.get('confidence', 0),
                'success': True,
                'type': 'final'
            })
        else:
            partial = json.loads(rec.PartialResult())
            return jsonify({
                'text': partial.get('partial', ''),
                'success': True,
                'type': 'partial'
            })
            
    except Exception as e:
        print(f"语音识别错误: {e}")
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/recognize_stream', methods=['POST'])
def recognize_audio_stream():
    """流式语音识别接口"""
    global model
    
    if not model:
        return jsonify({
            'error': 'Vosk 模型未初始化',
            'success': False
        }), 500
    
    # 基于会话维持识别器状态，避免每次请求都新建导致始终只有 partial
    try:
        # 读取会话ID与结束标志
        session_id = request.headers.get('X-Session-Id') or request.args.get('session_id')
        if not session_id:
            # 退化处理：使用远端地址作为会话ID，仍建议前端显式传递 X-Session-Id
            session_id = request.remote_addr or 'default'
        end_of_utt = str(request.headers.get('X-End-Of-Utterance', '0')).lower() in ('1', 'true', 'yes')

        # 为该会话准备互斥锁
        lock = session_locks.setdefault(session_id, threading.Lock())
    
        # 如果是结束标志请求（允许空body），直接返回最终结果并清理该会话的识别器
        if end_of_utt:
            with lock:
                rec_session = recognizers.pop(session_id, None)
                # 标记会话已关闭，忽略迟到的音频块
                session_closed.add(session_id)
                try:
                    if rec_session is None:
                        # 没有可用的会话，返回空的final，避免阻塞前端流程
                        return jsonify({
                            'text': '',
                            'success': True,
                            'type': 'final'
                        })
                    result_str = rec_session.FinalResult()
                    result = json.loads(result_str) if result_str else {}
                    print(f"✅ 会话 {session_id} 最终结果: {result}")
                    return jsonify({
                        'text': result.get('text', ''),
                        'confidence': result.get('confidence', 0),
                        'success': True,
                        'type': 'final'
                    })
                finally:
                    # 清理该会话的锁与关闭标志
                    session_locks.pop(session_id, None)
                    session_closed.discard(session_id)
    
        # 普通音频数据处理分支
        audio_data = request.get_data()
        print(f"📥 收到音频数据: {len(audio_data)} bytes (session={session_id})")
        if len(audio_data) == 0:
            print("⚠️ 音频数据为空")
            return jsonify({
                'error': '音频数据为空',
                'success': False
            }), 400
    
        if len(audio_data) % 4 != 0:
            print(f"⚠️ 音频数据长度不是4的倍数: {len(audio_data)}")
            return jsonify({
                'error': f'音频数据长度无效: {len(audio_data)} bytes，应为4的倍数',
                'success': False
            }), 400
    
        # 将 Float32Array 转换为 int16
        try:
            float_data = np.frombuffer(audio_data, dtype=np.float32)
            print(f"🔢 Float32数据: {len(float_data)} samples, 范围: [{float_data.min():.3f}, {float_data.max():.3f}]")
            if len(float_data) == 0:
                print("⚠️ Float32数据为空")
                return jsonify({
                    'error': 'Float32数据为空',
                    'success': False
                }), 400
            if np.any(np.isnan(float_data)) or np.any(np.isinf(float_data)):
                print("⚠️ 检测到NaN或Inf值，进行清理")
                float_data = np.nan_to_num(float_data, nan=0.0, posinf=1.0, neginf=-1.0)
            float_data = np.clip(float_data, -1.0, 1.0)
            data_range = float_data.max() - float_data.min()
            if data_range < 1e-6:
                print(f"⚠️ 音频数据范围过小: {data_range}, 可能是静音")
            int16_data = (float_data * 32767).astype(np.int16)
            print(f"🔄 转换为Int16: {len(int16_data)} samples, 范围: [{int16_data.min()}, {int16_data.max()}]")
        except Exception as conv_error:
            print(f"❌ 数据转换错误: {conv_error}")
            print(f"❌ 原始数据长度: {len(audio_data)} bytes")
            import traceback
            print(f"❌ 转换错误堆栈: {traceback.format_exc()}")
            return jsonify({
                'error': f'数据转换失败: {str(conv_error)}',
                'success': False
            }), 400
    
        try:
            audio_bytes = int16_data.tobytes()
            print(f"🎤 发送到Vosk: {len(audio_bytes)} bytes")
            if len(audio_bytes) < 640:  # <20ms
                print(f"⚠️ 音频数据过短: {len(audio_bytes)} bytes, 跳过处理")
                return jsonify({
                    'text': '',
                    'success': True,
                    'type': 'partial'
                })
            if len(audio_bytes) % 2 != 0:
                print(f"⚠️ 音频数据长度不是偶数: {len(audio_bytes)} bytes, 截断1字节")
                audio_bytes = audio_bytes[:-1]
            max_bytes = 16000 * 2
            if len(audio_bytes) > max_bytes:
                print(f"⚠️ 音频数据过长: {len(audio_bytes)} bytes, 截断到 {max_bytes} bytes")
                audio_bytes = audio_bytes[:max_bytes]
            samples_count = len(audio_bytes) // 2
            print(f"📊 音频样本数: {samples_count}, 预期时长: {samples_count/16000:.3f}秒")
    
            audio_samples = np.frombuffer(audio_bytes, dtype=np.int16)
            if len(audio_samples) > 1:
                diff = np.abs(np.diff(audio_samples.astype(np.float32)))
                max_diff = np.max(diff)
                if max_diff > 20000:
                    print(f"⚠️ 检测到音频数据跳跃过大: {max_diff}, 进行平滑处理")
                    for i in range(1, len(audio_samples)):
                        if abs(int(audio_samples[i]) - int(audio_samples[i-1])) > 20000:
                            audio_samples[i] = audio_samples[i-1]
                    audio_bytes = audio_samples.tobytes()
    
            min_samples = 160
            if len(audio_samples) < min_samples:
                print(f"⚠️ 音频数据样本数过少: {len(audio_samples)}, 最少需要: {min_samples}")
                padding = np.zeros(min_samples - len(audio_samples), dtype=np.int16)
                audio_samples = np.concatenate([audio_samples, padding])
                audio_bytes = audio_samples.tobytes()
                print(f"🔧 已填充到: {len(audio_samples)} 样本")
    
            # 获取或创建该会话的识别器，并保证串行访问
            lock = session_locks.setdefault(session_id, threading.Lock())
            with lock:
                # 如果会话已标记关闭，忽略迟到的音频
                if session_id in session_closed:
                    print(f"ℹ️ 会话 {session_id} 已关闭，忽略迟到音频块")
                    return jsonify({
                        'text': '',
                        'success': True,
                        'type': 'partial'
                    })
                local_rec = recognizers.get(session_id)
                if local_rec is None:
                    try:
                        local_rec = vosk.KaldiRecognizer(model, 16000)
                        recognizers[session_id] = local_rec
                        print(f"🆕 创建会话识别器: {session_id}")
                    except Exception as e:
                        print(f"❌ 创建识别器失败: {e}")
                        return jsonify({
                            'error': f'创建识别器失败: {str(e)}',
                            'success': False
                        }), 500

                # 进行识别（会话内累积）
                accept_result = local_rec.AcceptWaveform(audio_bytes)
                if accept_result:
                    result_str = local_rec.Result()
                    result = json.loads(result_str)
                    print(f"✅ 会话 {session_id} 最终结果: {result}")
                    return jsonify({
                        'text': result.get('text', ''),
                        'confidence': result.get('confidence', 0),
                        'success': True,
                        'type': 'final'
                    })
                else:
                    partial_str = local_rec.PartialResult()
                    partial = json.loads(partial_str)
                    print(f"🎤 会话 {session_id} 部分结果: {partial}")
                    return jsonify({
                        'text': partial.get('partial', ''),
                        'success': True,
                        'type': 'partial'
                    })
        except Exception as vosk_error:
            print(f"❌ Vosk处理错误: {vosk_error}")
            print(f"❌ 错误类型: {type(vosk_error)}")
            import traceback
            print(f"❌ 错误堆栈: {traceback.format_exc()}")
            return jsonify({
                'error': f'Vosk处理失败: {str(vosk_error)}',
                'success': False
            }), 500

    except Exception as e:
        print(f"❌ 流式语音识别错误: {e}")
        print(f"❌ 错误类型: {type(e)}")
        import traceback
        print(f"❌ 错误堆栈: {traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/reset', methods=['POST'])
def reset_recognizer():
    """重置识别器"""
    global rec
    
    if not model:
        return jsonify({
            'error': 'Vosk 模型未初始化',
            'success': False
        }), 500
    
    try:
        rec = vosk.KaldiRecognizer(model, 16000)
        return jsonify({
            'success': True,
            'message': '识别器已重置'
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

if __name__ == '__main__':
    print("启动 Vosk 语音识别服务...")
    
    # 初始化模型
    if not init_vosk_model():
        print("模型初始化失败，退出")
        exit(1)
    
    print("服务启动成功，监听端口 5001")
    print("API 端点:")
    print("  GET  /health - 健康检查")
    print("  POST /recognize - 文件语音识别")
    print("  POST /recognize_stream - 流式语音识别")
    print("  POST /reset - 重置识别器")
    
    app.run(host='0.0.0.0', port=5001, debug=True)
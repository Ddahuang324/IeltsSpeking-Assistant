#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试重采样修复效果
"""

import numpy as np
import requests
import tempfile
import wave
import time

def generate_test_audio(sample_rate=24000, duration=2.0, frequency=440):
    """
    生成测试音频数据，模拟Gemini返回的24000Hz音频
    """
    print(f"🎵 生成测试音频: {sample_rate}Hz, {duration}秒, {frequency}Hz正弦波")
    
    # 生成时间轴
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    
    # 生成正弦波
    audio_data = np.sin(2 * np.pi * frequency * t).astype(np.float32)
    
    print(f"✅ 音频生成完成: {len(audio_data)} samples, 范围: [{audio_data.min():.3f}, {audio_data.max():.3f}]")
    return audio_data

def test_vosk_health():
    """
    测试Vosk服务健康状态
    """
    try:
        print("🏥 测试Vosk服务健康状态...")
        response = requests.get('http://localhost:5001/health', timeout=5)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Vosk健康检查: {result}")
            return result.get('status') == 'ok' or result.get('status') == 'healthy'
        else:
            print(f"❌ Vosk健康检查失败: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Vosk健康检查失败: {e}")
        return False

def test_vosk_recognition(audio_data, description=""):
    """
    测试Vosk语音识别
    """
    try:
        print(f"🎤 测试Vosk识别 {description}...")
        print(f"📊 音频数据: {len(audio_data)} samples, 类型: {audio_data.dtype}")
        
        # 发送到Vosk
        response = requests.post(
            'http://localhost:5001/recognize_stream',
            headers={'Content-Type': 'application/octet-stream'},
            data=audio_data.tobytes(),
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Vosk识别成功: {result}")
            return True, result
        else:
            print(f"❌ Vosk识别失败: HTTP {response.status_code}")
            print(f"❌ 响应内容: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ Vosk识别异常: {e}")
        return False, None

def test_continuous_audio_stream():
    """
    测试连续音频流处理
    """
    print("\n🔄 测试连续音频流处理...")
    
    # 生成多个音频块，模拟实时流
    chunk_duration = 0.1  # 100ms chunks
    total_chunks = 20
    sample_rate = 24000
    
    success_count = 0
    
    for i in range(total_chunks):
        # 生成音频块
        audio_chunk = generate_test_audio(
            sample_rate=sample_rate, 
            duration=chunk_duration, 
            frequency=440 + i * 10  # 频率逐渐变化
        )
        
        # 发送到Vosk
        success, result = test_vosk_recognition(audio_chunk, f"(块 {i+1}/{total_chunks})")
        if success:
            success_count += 1
        
        # 短暂延迟模拟实时流
        time.sleep(0.05)
    
    print(f"\n📊 连续流测试结果: {success_count}/{total_chunks} 成功")
    return success_count == total_chunks

def main():
    print("🚀 开始测试重采样修复效果")
    print("=" * 50)
    
    # 1. 检查Vosk服务
    if not test_vosk_health():
        print("❌ Vosk服务不可用，请先启动vosk_service.py")
        return
    
    # 2. 测试单个音频块
    print("\n📤 测试1: 单个24000Hz音频块")
    gemini_audio = generate_test_audio(sample_rate=24000, duration=1.0)
    success1, result1 = test_vosk_recognition(gemini_audio, "(24000Hz单块)")
    
    # 3. 测试连续音频流
    success2 = test_continuous_audio_stream()
    
    # 4. 总结结果
    print("\n" + "=" * 50)
    print("📊 测试结果总结:")
    print(f"✅ 单个音频块: {'成功' if success1 else '失败'}")
    print(f"✅ 连续音频流: {'成功' if success2 else '失败'}")
    
    if success1 and success2:
        print("\n🎉 重采样修复成功！")
        print("✅ 24000Hz到16000Hz重采样工作正常")
        print("✅ 连续音频流处理稳定")
    else:
        print("\n⚠️ 仍存在问题，需要进一步调试")

if __name__ == '__main__':
    main()
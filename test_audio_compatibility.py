#!/usr/bin/env python3
"""
测试Gemini音频数据与Vosk兼容性的脚本
"""

import numpy as np
import requests
import json
import time
import wave
import tempfile
import os

def generate_test_audio(sample_rate=24000, duration=2.0, frequency=440):
    """
    生成测试音频数据，模拟Gemini返回的24000Hz音频
    """
    print(f"🎵 生成测试音频: {sample_rate}Hz, {duration}秒, {frequency}Hz正弦波")
    
    # 生成时间轴
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    
    # 生成正弦波
    audio_data = np.sin(2 * np.pi * frequency * t)
    
    # 添加一些噪声使其更真实
    noise = np.random.normal(0, 0.1, audio_data.shape)
    audio_data = audio_data + noise
    
    # 限制幅度范围
    audio_data = np.clip(audio_data, -1.0, 1.0)
    
    print(f"✅ 音频生成完成: {len(audio_data)} samples, 范围: [{audio_data.min():.3f}, {audio_data.max():.3f}]")
    return audio_data.astype(np.float32)

def save_as_wav(audio_data, sample_rate, filename):
    """
    将音频数据保存为WAV文件
    """
    # 转换为int16
    int16_data = (audio_data * 32767).astype(np.int16)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)  # 单声道
        wav_file.setsampwidth(2)  # 16位
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(int16_data.tobytes())
    
    print(f"💾 音频已保存: {filename}")

def test_vosk_health():
    """
    测试Vosk服务健康状态
    """
    try:
        print("🏥 测试Vosk服务健康状态...")
        response = requests.get('http://localhost:5001/health', timeout=5)
        result = response.json()
        print(f"✅ Vosk健康检查: {result}")
        return result.get('status') == 'ok' or result.get('status') == 'healthy'
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

def test_resampling(original_data, original_rate, target_rate):
    """
    测试重采样功能
    """
    print(f"🔄 测试重采样: {original_rate}Hz -> {target_rate}Hz")
    
    # 简单线性插值重采样
    resample_ratio = target_rate / original_rate
    resampled_length = int(len(original_data) * resample_ratio)
    resampled_data = np.zeros(resampled_length, dtype=np.float32)
    
    for i in range(resampled_length):
        source_index = i / resample_ratio
        index = int(source_index)
        fraction = source_index - index
        
        if index + 1 < len(original_data):
            resampled_data[i] = original_data[index] * (1 - fraction) + original_data[index + 1] * fraction
        else:
            resampled_data[i] = original_data[index]
    
    print(f"✅ 重采样完成: {len(original_data)} -> {len(resampled_data)} samples")
    return resampled_data

def main():
    print("🚀 开始Gemini音频格式与Vosk兼容性测试")
    print("=" * 50)
    
    # 1. 检查Vosk服务
    if not test_vosk_health():
        print("❌ Vosk服务不可用，请先启动vosk_service.py")
        return
    
    # 2. 生成24000Hz测试音频（模拟Gemini）
    gemini_audio = generate_test_audio(sample_rate=24000, duration=1.0)
    
    # 3. 保存原始音频
    with tempfile.NamedTemporaryFile(suffix='_24khz.wav', delete=False) as f:
        save_as_wav(gemini_audio, 24000, f.name)
        print(f"📁 24kHz音频文件: {f.name}")
    
    # 4. 测试直接发送24000Hz音频到Vosk
    print("\n📤 测试1: 直接发送24000Hz音频到Vosk")
    success1, result1 = test_vosk_recognition(gemini_audio, "(24000Hz原始)")
    
    # 5. 重采样到16000Hz
    print("\n🔄 测试2: 重采样到16000Hz后发送")
    resampled_audio = test_resampling(gemini_audio, 24000, 16000)
    
    # 保存重采样音频
    with tempfile.NamedTemporaryFile(suffix='_16khz.wav', delete=False) as f:
        save_as_wav(resampled_audio, 16000, f.name)
        print(f"📁 16kHz音频文件: {f.name}")
    
    success2, result2 = test_vosk_recognition(resampled_audio, "(16000Hz重采样)")
    
    # 6. 测试不同数据格式
    print("\n🔢 测试3: 测试不同数据格式")
    
    # Int16格式
    int16_audio = (resampled_audio * 32767).astype(np.int16)
    int16_as_float32 = int16_audio.astype(np.float32) / 32768.0
    success3, result3 = test_vosk_recognition(int16_as_float32, "(Int16转Float32)")
    
    # 7. 总结结果
    print("\n" + "=" * 50)
    print("📊 测试结果总结:")
    print(f"✅ 24000Hz直接发送: {'成功' if success1 else '失败'}")
    print(f"✅ 16000Hz重采样: {'成功' if success2 else '失败'}")
    print(f"✅ Int16格式转换: {'成功' if success3 else '失败'}")
    
    if success2:
        print("\n🎯 建议解决方案:")
        print("1. 确保Gemini音频数据正确重采样到16000Hz")
        print("2. 验证Float32数据范围在[-1.0, 1.0]")
        print("3. 检查音频数据的连续性和完整性")
    else:
        print("\n⚠️ 问题分析:")
        print("1. 重采样算法可能需要优化")
        print("2. 数据格式转换可能存在问题")
        print("3. Vosk服务配置可能需要调整")

if __name__ == '__main__':
    main()
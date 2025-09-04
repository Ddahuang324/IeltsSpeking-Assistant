import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// 存储进程引用
let englishAnalysisProcess: any = null;

// 进程ID文件路径
const PID_FILE = path.join(process.cwd(), '.english_analysis_pid');

// 保存进程ID到文件
function savePidToFile(pid: number) {
  try {
    fs.writeFileSync(PID_FILE, pid.toString());
    console.log(`已保存English Analysis PID ${pid} 到文件`);
  } catch (error) {
    console.error('保存English Analysis PID文件失败:', error);
  }
}

// 检查进程是否存在
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0); // 发送信号0检查进程是否存在
    return true;
  } catch {
    return false;
  }
}

// 清理已停止的进程
function cleanupStoppedProcess() {
  // 检查PID文件中的进程
  if (fs.existsSync(PID_FILE)) {
    try {
      const pidContent = fs.readFileSync(PID_FILE, 'utf8').trim();
      const pid = parseInt(pidContent);
      
      if (!isNaN(pid) && !isProcessRunning(pid)) {
        console.log(`清理已停止的English Analysis进程PID文件: ${pid}`);
        fs.unlinkSync(PID_FILE);
      }
    } catch (error) {
      console.error('清理English Analysis PID文件失败:', error);
      // 如果读取失败，删除损坏的PID文件
      try {
        fs.unlinkSync(PID_FILE);
      } catch {}
    }
  }
  
  // 检查模块变量中的进程
  if (englishAnalysisProcess && englishAnalysisProcess.pid && !isProcessRunning(englishAnalysisProcess.pid)) {
    console.log(`清理已停止的English Analysis模块进程: ${englishAnalysisProcess.pid}`);
    englishAnalysisProcess = null;
  }
}

export async function POST() {
  try {
    // 清理已停止的进程
    cleanupStoppedProcess();
    
    // 检查是否已有进程在运行
    let existingPid: number | null = null;
    
    // 检查模块变量中的进程
    if (englishAnalysisProcess && englishAnalysisProcess.pid && isProcessRunning(englishAnalysisProcess.pid)) {
      existingPid = englishAnalysisProcess.pid;
    }
    
    // 检查PID文件中的进程
    if (!existingPid && fs.existsSync(PID_FILE)) {
      try {
        const pidContent = fs.readFileSync(PID_FILE, 'utf8').trim();
        const pid = parseInt(pidContent);
        
        if (!isNaN(pid) && isProcessRunning(pid)) {
          existingPid = pid;
        }
      } catch (error) {
        console.error('读取English Analysis PID文件失败:', error);
      }
    }
    
    // 如果已有进程在运行，返回现有进程信息
    if (existingPid) {
      console.log(`English Analysis服务已在运行，PID: ${existingPid}`);
      return NextResponse.json({
        success: true,
        message: `English Analysis服务已在运行 (PID: ${existingPid})`,
        processId: existingPid
      });
    }
    
    // 如果有已停止的进程引用，清理它
    if (englishAnalysisProcess) {
      englishAnalysisProcess.kill().catch(() => {}); // 忽略错误
      englishAnalysisProcess = null;
    }

    // 获取项目根目录
    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, 'english_analysis_service.py');

    // 检查脚本文件是否存在
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        {
          success: false,
          error: 'English Analysis服务脚本不存在',
          details: `脚本路径: ${scriptPath}`
        },
        { status: 404 }
      );
    }

    // 启动Python服务 - 使用detached模式完全分离进程
    englishAnalysisProcess = spawn('python3', [scriptPath], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'], // 忽略stdin，避免进程依赖
      detached: true, // 分离进程，不依赖父进程
      shell: false
    });
    
    // 分离进程，使其不依赖Node.js进程
    if (englishAnalysisProcess.pid) {
      englishAnalysisProcess.unref(); // 允许Node.js进程退出而不等待子进程
    }

    // 监听进程输出
    englishAnalysisProcess.stdout.on('data', (data: Buffer) => {
      console.log(`English Analysis服务输出: ${data.toString()}`);
    });

    englishAnalysisProcess.stderr.on('data', (data: Buffer) => {
      console.error(`English Analysis服务错误: ${data.toString()}`);
    });

    englishAnalysisProcess.on('close', (code: number) => {
      console.log(`English Analysis服务进程退出，代码: ${code}`);
      englishAnalysisProcess = null;
    });

    englishAnalysisProcess.on('error', (error: Error) => {
      console.error(`English Analysis服务进程错误: ${error.message}`);
      englishAnalysisProcess = null;
    });

    // 保存进程ID到文件
    if (englishAnalysisProcess.pid) {
      savePidToFile(englishAnalysisProcess.pid);
    }

    return NextResponse.json({
      success: true,
      message: 'English Analysis服务启动成功',
      processId: englishAnalysisProcess.pid
    });

  } catch (error) {
    console.error('启动English Analysis服务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '启动English Analysis服务失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 导出进程引用供其他模块使用
export { englishAnalysisProcess };
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// 存储进程引用
let voskProcess: any = null;

// 进程ID文件路径
const PID_FILE = path.join(process.cwd(), '.vosk_pid');



// 保存进程ID到文件
function savePidToFile(pid: number) {
  try {
    fs.writeFileSync(PID_FILE, pid.toString());
    console.log(`已保存PID ${pid} 到文件`);
  } catch (error) {
    console.error('保存PID文件失败:', error);
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
        console.log(`清理已停止的进程PID文件: ${pid}`);
        fs.unlinkSync(PID_FILE);
      }
    } catch (error) {
      console.error('清理PID文件失败:', error);
      // 如果读取失败，删除损坏的PID文件
      try {
        fs.unlinkSync(PID_FILE);
      } catch {}
    }
  }
  
  // 检查模块变量中的进程
  if (voskProcess && voskProcess.pid && !isProcessRunning(voskProcess.pid)) {
    console.log(`清理已停止的模块进程: ${voskProcess.pid}`);
    voskProcess = null;
  }
}

export async function POST() {
  try {
    // 清理已停止的进程
    cleanupStoppedProcess();
    
    // 检查是否已有进程在运行
    let existingPid: number | null = null;
    
    // 检查模块变量中的进程
    if (voskProcess && voskProcess.pid && isProcessRunning(voskProcess.pid)) {
      existingPid = voskProcess.pid;
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
        console.error('读取PID文件失败:', error);
      }
    }
    
    // 如果已有进程在运行，返回现有进程信息
    if (existingPid) {
      console.log(`Vosk服务已在运行，PID: ${existingPid}`);
      return NextResponse.json({
        success: true,
        message: `Vosk服务已在运行 (PID: ${existingPid})`,
        processId: existingPid
      });
    }
    
    // 如果有已停止的进程引用，清理它
    if (voskProcess) {
      voskProcess.kill().catch(() => {}); // 忽略错误
      voskProcess = null;
    }

    // 获取项目根目录
    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, 'vosk_service.py');

    // 启动Python服务 - 使用detached模式完全分离进程
    voskProcess = spawn('python3', [scriptPath], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'], // 忽略stdin，避免进程依赖
      detached: true, // 分离进程，不依赖父进程
      shell: false
    });
    
    // 分离进程，使其不依赖Node.js进程
    if (voskProcess.pid) {
      voskProcess.unref(); // 允许Node.js进程退出而不等待子进程
    }

    // 监听进程输出
    voskProcess.stdout.on('data', (data: Buffer) => {
      console.log(`Vosk服务输出: ${data.toString()}`);
    });

    voskProcess.stderr.on('data', (data: Buffer) => {
      console.error(`Vosk服务错误: ${data.toString()}`);
    });

    voskProcess.on('close', (code: number) => {
      console.log(`Vosk服务进程退出，代码: ${code}`);
      voskProcess = null;
    });

    voskProcess.on('error', (error: Error) => {
      console.error(`Vosk服务进程错误: ${error.message}`);
      voskProcess = null;
    });

    // 保存进程ID到文件
    if (voskProcess.pid) {
      savePidToFile(voskProcess.pid);
    }

    return NextResponse.json({
      success: true,
      message: 'Vosk服务启动成功',
      processId: voskProcess.pid
    });

  } catch (error) {
    console.error('启动Vosk服务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '启动Vosk服务失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 导出进程引用供其他模块使用
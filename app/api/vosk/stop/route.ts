import { NextRequest, NextResponse } from 'next/server';
import { voskProcess, setVoskProcess } from '../start/route';
import fs from 'fs';
import path from 'path';

// 进程ID文件路径
const PID_FILE = path.join(process.cwd(), '.vosk_pid');

// 检查进程是否存在
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0); // 发送信号0检查进程是否存在
    return true;
  } catch (error) {
    return false;
  }
}

// 强制终止进程
function forceKillProcess(pid: number): boolean {
  try {
    if (isProcessRunning(pid)) {
      // 对于分离的进程，直接使用SIGKILL
      process.kill(pid, 'SIGKILL');
      console.log(`强制终止进程 ${pid}`);
      
      // 等待一下确认进程已终止
      setTimeout(() => {
        if (isProcessRunning(pid)) {
          console.error(`进程 ${pid} 仍在运行，尝试系统级终止`);
          // 尝试使用系统命令终止
          try {
            require('child_process').execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          } catch (e) {
            console.error(`系统级终止进程 ${pid} 失败:`, e);
          }
        }
      }, 1000);
      
      return true;
    }
    return false;
  } catch (error) {
    console.error(`强制终止进程 ${pid} 失败:`, error);
    return false;
  }
}

// 清理PID文件
function cleanupPidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
      console.log('已清理PID文件');
    }
  } catch (error) {
    console.error('清理PID文件失败:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { processId } = body;
    
    let processKilled = false;
    let targetPid: number | null = null;

    // 1. 尝试通过模块变量停止进程
    if (voskProcess && voskProcess.pid) {
      targetPid = voskProcess.pid;
      try {
        console.log(`尝试停止分离的模块进程 ${targetPid}`);
        
        // 对于分离的进程，直接使用强力终止
         if (targetPid && isProcessRunning(targetPid)) {
           // 先尝试SIGTERM
           process.kill(targetPid, 'SIGTERM');
           
           // 等待2秒后强制终止
           await new Promise(resolve => setTimeout(resolve, 2000));
           
           if (isProcessRunning(targetPid)) {
             console.log(`进程 ${targetPid} 未响应SIGTERM，强制终止`);
             forceKillProcess(targetPid);
           }
           
           processKilled = true;
           console.log(`成功停止分离的模块进程 ${targetPid}`);
         }
       } catch (error) {
         console.error(`停止分离的模块进程 ${targetPid} 失败:`, error);
         // 即使出错也尝试强制终止
         if (targetPid && isProcessRunning(targetPid)) {
           forceKillProcess(targetPid);
           processKilled = true;
         }
      }
    }

    // 2. 尝试通过传入的processId停止进程
    if (!processKilled && processId && typeof processId === 'number') {
      targetPid = processId;
      if (isProcessRunning(processId)) {
        try {
          console.log(`尝试通过PID停止进程 ${processId}`);
          process.kill(processId, 'SIGTERM');
          
          // 等待一段时间后检查是否需要强制终止
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (isProcessRunning(processId)) {
            forceKillProcess(processId);
          }
          
          processKilled = true;
          console.log(`成功停止PID进程 ${processId}`);
        } catch (error) {
          console.error(`通过PID停止进程 ${processId} 失败:`, error);
        }
      }
    }

    // 3. 尝试通过PID文件停止进程
    if (!processKilled && fs.existsSync(PID_FILE)) {
      try {
        const pidContent = fs.readFileSync(PID_FILE, 'utf8').trim();
        const pid = parseInt(pidContent);
        
        if (!isNaN(pid) && isProcessRunning(pid)) {
          targetPid = pid;
          console.log(`尝试通过PID文件停止进程 ${pid}`);
          
          process.kill(pid, 'SIGTERM');
          
          // 等待一段时间后检查是否需要强制终止
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (isProcessRunning(pid)) {
            forceKillProcess(pid);
          }
          
          processKilled = true;
          console.log(`成功通过PID文件停止进程 ${pid}`);
        }
      } catch (error) {
        console.error('通过PID文件停止进程失败:', error);
      }
    }

    // 4. 清理资源
    setVoskProcess(null); // 清理模块变量
    cleanupPidFile(); // 清理PID文件

    if (processKilled) {
      return NextResponse.json({
        success: true,
        message: `Vosk服务停止成功 (PID: ${targetPid})`
      });
    } else {
      return NextResponse.json({
        success: true,
        message: '没有发现运行中的Vosk服务'
      });
    }

  } catch (error) {
    console.error('停止Vosk服务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '停止Vosk服务失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
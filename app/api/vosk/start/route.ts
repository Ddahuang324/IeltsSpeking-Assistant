import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// 存储进程引用
let voskProcess: any = null;

export async function POST(request: NextRequest) {
  try {
    // 如果已经有进程在运行，先停止它
    if (voskProcess) {
      voskProcess.kill();
      voskProcess = null;
    }

    // 获取项目根目录
    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, 'vosk_service.py');

    // 启动Python服务
    voskProcess = spawn('python3', [scriptPath], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

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
export { voskProcess };
import { NextRequest, NextResponse } from 'next/server';
import { voskProcess } from '../start/route';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { processId } = body;

    // 如果有进程在运行，停止它
    if (voskProcess && voskProcess.pid) {
      try {
        // 尝试优雅地终止进程
        voskProcess.kill('SIGTERM');
        
        // 等待一段时间后强制终止
        setTimeout(() => {
          if (voskProcess && !voskProcess.killed) {
            voskProcess.kill('SIGKILL');
          }
        }, 5000);

        return NextResponse.json({
          success: true,
          message: 'Vosk服务停止成功'
        });
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
    } else {
      // 如果没有进程在运行，尝试通过进程ID终止
      if (processId) {
        try {
          process.kill(processId, 'SIGTERM');
          return NextResponse.json({
            success: true,
            message: 'Vosk服务停止成功'
          });
        } catch (error) {
          console.error('通过PID停止进程失败:', error);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: '没有运行中的Vosk服务'
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
import { memo, ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import { useLiveAPIContext } from '@/vendor/contexts/LiveAPIContext';
import { UseMediaStreamResult } from '@/vendor/hooks/use-media-stream-mux';
import { useScreenCapture } from '@/vendor/hooks/use-screen-capture';
import { useWebcam } from '@/vendor/hooks/use-webcam';
import { AudioRecorder } from '@/vendor/lib/audio-recorder';
import {
	AudioOutlined,
	VideoCameraOutlined,
	DesktopOutlined,

} from '@ant-design/icons';
import { Button, Modal } from 'antd';

export type MediaButtonsProps = {
	videoRef: RefObject<HTMLVideoElement>;
	children?: ReactNode;
	supportsVideo: boolean;
	onVideoStreamChange?: (stream: MediaStream | null) => void;
};

type MediaStreamButtonProps = {
	isStreaming: boolean;
	onIcon: React.ReactNode;
	offIcon: React.ReactNode;
	start: () => Promise<void>;
	stop: () => void;
};

/**
 * button used for triggering webcam or screen-capture
 */
const MediaStreamButton = memo(
	({ isStreaming, onIcon, offIcon, start, stop }: MediaStreamButtonProps) =>
		isStreaming ? (
			<Button
				type='primary'
				shape='circle'
				icon={onIcon}
				onClick={stop}
				style={{ marginLeft: 10 }}
			/>
		) : (
			<Button
				type='default'
				shape='circle'
				icon={offIcon}
				onClick={start}
				style={{ marginLeft: 10 }}
			/>
		)
);

const DEFAULT_MUTED_STATE = false; // 设置初始状态为非静音状态

function MediaButtons({
	videoRef,
	children,
	onVideoStreamChange = () => {},
	supportsVideo,
}: MediaButtonsProps) {
	const videoStreams = [useWebcam(), useScreenCapture()];
	const [activeVideoStream, setActiveVideoStream] =
		useState<MediaStream | null>(null);
	const [webcam, screenCapture] = videoStreams;
	const [inVolume, setInVolume] = useState(0);
	const [audioRecorder] = useState(() => new AudioRecorder());
	const [muted, setMuted] = useState(DEFAULT_MUTED_STATE);
	const renderCanvasRef = useRef<HTMLCanvasElement>(null);

	const { client, connected } = useLiveAPIContext();

	useEffect(() => {
		document.documentElement.style.setProperty(
			'--volume',
			`${Math.max(5, Math.min(inVolume * 200, 8))}px`
		);
	}, [inVolume]);

	useEffect(() => {
		const resetState = () => {
			webcam.stop();
			screenCapture.stop();
			audioRecorder.stop();
			setMuted(DEFAULT_MUTED_STATE);
			setActiveVideoStream(null);
			onVideoStreamChange(null);
			setInVolume(0);
		};

		client.on('close', resetState);

		return () => {
			client.off('close', resetState);
		};
	}, [client, webcam, screenCapture, audioRecorder, onVideoStreamChange]);

	useEffect(() => {
		const onData = (base64: string) => {
			client.sendRealtimeInput([
				{
					mimeType: 'audio/pcm;rate=16000',
					data: base64,
				},
			]);
		};
		if (connected && !muted && audioRecorder) {
			try {
				audioRecorder
					.on('data', onData)
					.on('volume', setInVolume)
					.start()
					.catch((err: any) => {
						Modal.error({
							title: '麦克风不可用',
							content:
								(err?.message || '无法获取麦克风，请检查浏览器权限或系统设置。') +
								' 若刚修改了权限，请刷新页面重试。',
							okText: '我知道了',
						});
					});
			} catch (err: any) {
				Modal.error({
					title: '麦克风初始化失败',
					content:
						(err?.message || '无法初始化音频录制') +
						'。请确认浏览器支持、HTTPS/本地环境以及权限已授予。',
					okText: '我知道了',
				});
			}
		} else {
			audioRecorder.stop();
		}
		return () => {
			audioRecorder.off('data', onData).off('volume', setInVolume);
		};
	}, [connected, client, muted, audioRecorder]);

	useEffect(() => {
		if (videoRef.current) {
			videoRef.current.srcObject = activeVideoStream;
		}

		let timeoutId = -1;

		function sendVideoFrame() {
			const video = videoRef.current;
			const canvas = renderCanvasRef.current;

			if (!video || !canvas) {
				return;
			}

			const ctx = canvas.getContext('2d')!;
			canvas.width = video.videoWidth * 0.25;
			canvas.height = video.videoHeight * 0.25;
			if (canvas.width + canvas.height > 0) {
				ctx.drawImage(
					videoRef.current as HTMLVideoElement,
					0,
					0,
					canvas.width,
					canvas.height
				);
				const base64 = canvas.toDataURL('image/jpeg', 1.0);
				const data = base64.slice(base64.indexOf(',') + 1, Infinity);
				client.sendRealtimeInput([{ mimeType: 'image/jpeg', data }]);
			}
			if (connected) {
				timeoutId = window.setTimeout(sendVideoFrame, 1000 / 0.5);
			}
		}
		if (connected && activeVideoStream !== null) {
			requestAnimationFrame(sendVideoFrame);
		}
		return () => {
			clearTimeout(timeoutId);
		};
	}, [connected, activeVideoStream, client, videoRef]);

	//handler for swapping from one video-stream to the next
	const changeStreams = (next?: UseMediaStreamResult) => async () => {
		if (!connected) return;

		if (next) {
			try {
				const mediaStream = await next.start();
				setActiveVideoStream(mediaStream);
				onVideoStreamChange(mediaStream);
			} catch (err: any) {
				Modal.error({
					title: next === webcam ? '摄像头不可用' : '屏幕共享不可用',
					content:
						(err?.message || '无法获取媒体流') +
						'。请检查浏览器权限、系统隐私设置或是否已阻止对应权限。',
					okText: '我知道了',
				});
				return;
			}
		} else {
			setActiveVideoStream(null);
			onVideoStreamChange(null);
		}

		videoStreams.filter((msr) => msr !== next).forEach((msr) => msr.stop());
	};

	return (
		<div className='control-tray'>
			<canvas style={{ display: 'none' }} ref={renderCanvasRef} />
			<div>
				<Button
					type={!muted && connected ? 'primary' : 'default'}
					shape='circle'
					icon={<AudioOutlined />}
					onClick={() => setMuted(!muted)}
				/>
				{supportsVideo && (
					<>
						<MediaStreamButton
							isStreaming={webcam.isStreaming}
							start={changeStreams(webcam)}
							stop={changeStreams()}
							onIcon={<VideoCameraOutlined />}
							offIcon={<VideoCameraOutlined />}
						/>
						<MediaStreamButton
							isStreaming={screenCapture.isStreaming}
							start={changeStreams(screenCapture)}
							stop={changeStreams()}
							onIcon={<DesktopOutlined />}
							offIcon={<DesktopOutlined />}
						/>
					</>
				)}
				{children}
			</div>
		</div>
	);
}

export default memo(MediaButtons);
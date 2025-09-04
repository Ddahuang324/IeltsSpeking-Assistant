'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import { PauseCircleOutlined, PoweroffOutlined } from '@ant-design/icons';
import MediaButtons from '@/components/media-buttons';
import { useLiveAPIContext } from '@/vendor/contexts/LiveAPIContext';
import {
	RealtimeInputMessage,
	ClientContentMessage,
	ServerContentMessage,
} from '@/vendor/multimodal-live-types';
import { base64sToArrayBuffer, pcmBufferToBlob } from '@/vendor/lib/utils';

import {
	Button,
	Layout,
	theme,
	Collapse,
	Input,
	Flex,
	Select,
	Tag,
	Checkbox,
	Modal,
	// App, // no longer using App.useApp modal
} from 'antd';
import { Sender, Bubble } from '@ant-design/x';
import { useLocalStorageState } from 'ahooks';
import FieldItem from '@/components/field-item';
import GeminiIcon from '@/app/icon/google-gemini-icon.svg';
import Image from 'next/image';
import { GPTVis } from '@antv/gpt-vis';
import { Part } from '@google/generative-ai';

const { Header, Content } = Layout;

interface ToolsState {
	codeExecution: boolean;
	functionCalling: boolean;
	automaticFunctionResponse: boolean;
	grounding: boolean;
	speechToText: boolean;
}

const fooAvatar: React.CSSProperties = {
	color: '#f56a00',
	backgroundColor: '#fde3cf',
};

const barAvatar: React.CSSProperties = {
	color: '#fff',
	backgroundColor: '#1677ff',
};

type MessageType =
	| RealtimeInputMessage
	| ClientContentMessage
	| ServerContentMessage
	| null;

const isClientMessage = (
	message: MessageType
): message is ClientContentMessage => {
	return message !== null && 'clientContent' in message;
};

const isServerMessage = (
	message: MessageType
): message is ServerContentMessage => {
	return message !== null && 'serverContent' in message;
};

const hasModelTurn = (
	content: ServerContentMessage['serverContent']
): content is { modelTurn: { parts: Part[] } } => {
	return 'modelTurn' in content && content.modelTurn !== null;
};

const MessageItem: React.FC<{ message: MessageType; outputMode: string }> = ({
	message,
	outputMode,
}) => {
	const textComponent = useMemo(() => {
		if (isClientMessage(message)) {
			const content = message.clientContent.turns?.[0]?.parts
				.map((p) => p.text)
				.join('');
			return content ? (
				<Bubble
					key={message.id}
					placement='end'
					content={<GPTVis>{content}</GPTVis>}
					typing={{ step: 2, interval: 50 }}
					avatar={{
						icon: <UserOutlined />,
						style: fooAvatar,
					}}
				/>
			) : null;
		}

		if (isServerMessage(message) && hasModelTurn(message.serverContent)) {
			const content = message.serverContent.modelTurn.parts
				.map((p) => p?.text ?? '')
				.join('');
			return content ? (
				<Bubble
					key={message.id}
					placement='start'
					content={<GPTVis>{content}</GPTVis>}
					typing={{ step: 10, interval: 50 }}
					avatar={{
						icon: <RobotOutlined />,
						style: barAvatar,
					}}
				/>
			) : null;
		}
		return null;
	}, [message]);

	const audioComponent = useMemo(() => {
		// 在audio_text模式下，不渲染音频组件
		if (outputMode === 'audio_text') {
			return null;
		}
		if (isServerMessage(message) && hasModelTurn(message.serverContent)) {
			const audioParts = message.serverContent.modelTurn?.parts.filter(
				(p) => p.inlineData
			);
			if (audioParts.length) {
				const base64s = audioParts
					.map((p) => p.inlineData?.data)
					.filter((data): data is string => data !== undefined);
				const buffer = base64sToArrayBuffer(base64s);
				const blob = pcmBufferToBlob(buffer, 24000);
				const audioUrl = URL.createObjectURL(blob);
				return (
					<Bubble
						key={`audio-${message.id}`}
						placement='start'
						content={
							<div>
								<audio
									style={{
										height: 30,
									}}
									controls
									src={audioUrl}
								/>
							</div>
						}
						avatar={{
							icon: <RobotOutlined />,
							style: barAvatar,
						}}
						styles={{
							content: {
								padding: 8,
							},
						}}
					/>
				);
			}
		}
		return null;
	}, [message, outputMode]);

	return (
		<>
			{textComponent}
			{audioComponent}
		</>
	);
};

const LivePage: React.FC = () => {
	// const { modal } = App.useApp();
	const {
		token: {
			colorBgLayout,
			colorFillAlter,
			borderRadiusLG,
			colorBgContainer,
		},
	} = theme.useToken();
	const videoRef = useRef<HTMLVideoElement>(null);
	// either the screen capture, the video or null, if null we hide it
	const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

	const {
		client,
		config,
		setConfig,
		connected,
		connect,
		disconnect,
		currentBotMessage,
		currentUserMessage,
		currentTranscriptMessage,
		setOutputMode,
		transcribedText,
		setSpeechToTextEnabled,
	} = useLiveAPIContext();

	// 监听连接异常断开，弹窗提示
	useEffect(() => {
		const onClose = (ev: CloseEvent) => {
			// 1000 表示正常关闭，其他为异常/错误
			if (ev.code !== 1000) {
				const reason = ev?.reason || '未知原因';
				Modal.error({
					title: '连接已断开',
					content: `WebSocket 已断开（代码 ${ev.code}）。${reason ? `原因：${reason}` : ''}。\n请检查网络、API Key（NEXT_PUBLIC_GEMINI_API_KEY）或模型/权限配置后重试。`,
					okText: '好的',
				});
			}
		};
		client.on('close', onClose);
		return () => {
			client.off('close', onClose);
		};
	}, [client]);

	const [textInput, setTextInput] = useState('');

	const [prompt, setPrompt] = useLocalStorageState('prompt', {
		defaultValue: '',
	});
	const [model, setModel] = useLocalStorageState('model', {
		defaultValue: 'gemini-live-2.5-flash-preview',
	});
	const [outPut, setOutPut] = useLocalStorageState('output', {
		defaultValue: 'audio',
	});

	useEffect(() => {
		setOutputMode(outPut);
	}, [outPut, setOutputMode]);

	const [voice, setVoice] = useLocalStorageState('voice', {
		defaultValue: 'Puck',
	});

	const [tools, setTools] = useLocalStorageState<ToolsState>('tools', {
		defaultValue: {
			codeExecution: false,
			functionCalling: false,
			automaticFunctionResponse: false,
			grounding: false,
			speechToText: true,
		},
	});

	// 同步语音转文字设置
	useEffect(() => {
		if (tools?.speechToText !== undefined) {
			setSpeechToTextEnabled(tools.speechToText);
		}
	}, [tools?.speechToText, setSpeechToTextEnabled]);

	const [toolsPaneActive, setToolsPaneActive] = useLocalStorageState<
		string[]
	>('tools-pane-active', {
		defaultValue: [],
	});

	const [messages, setMessages] = useState<MessageType[]>([]);

	const handleSubmit = () => {
		if (!connected) {
			Modal.error({
				title: '未连接到服务',
				content: '请先点击开始连接，然后再发送文本。',
				okText: '好的',
			});
			return;
		}
		client.send([{ text: textInput }]);
		setTextInput('');
	};

	useEffect(() => {
		console.log('currentBotMessage', currentBotMessage);
		if (currentBotMessage) {
			setMessages((messages) => {
				if (
					messages.filter((m) => m?.id === currentBotMessage?.id)
						.length > 0
				) {
					return messages.map((m) =>
						m?.id === currentBotMessage?.id ? currentBotMessage : m
					);
				} else {
					return [...messages, currentBotMessage];
				}
			});
		}
	}, [currentBotMessage]);

	// 在 Audio+Text 下，将最终转写结果作为一条对话消息加入历史
	useEffect(() => {
		console.log('currentTranscriptMessage', currentTranscriptMessage);
		if (currentTranscriptMessage) {
			setMessages((messages) => {
				if (
					messages.filter((m) => m?.id === currentTranscriptMessage?.id)
						.length > 0
				) {
					return messages.map((m) =>
						m?.id === currentTranscriptMessage?.id
							? currentTranscriptMessage
							: m
					);
				} else {
					return [...messages, currentTranscriptMessage];
				}
			});
		}
	}, [currentTranscriptMessage]);

	useEffect(() => {
		console.log('currentUserMessage', currentUserMessage);
		if (currentUserMessage) {
			setMessages((messages) => {
				if (
					messages.filter((m) => m?.id === currentUserMessage?.id)
						.length > 0
				) {
					return messages.map((m) =>
						m?.id === currentUserMessage?.id
							? currentUserMessage
							: m
					);
				} else {
					return [...messages, currentUserMessage];
				}
			});
		}
	}, [currentUserMessage]);

	console.log('messages', messages);

	useEffect(() => {
		const speechConfig = {
			voiceConfig: {
				prebuiltVoiceConfig: {
					voiceName: voice,
				},
			},
		};

		// 根据输出模式设置responseModalities
		let responseModalities: 'text' | 'audio' | 'image';
		if (outPut === 'audio_text') {
			// audio_text 模式：需要音频输出供Vosk转录，所以设置为audio
			responseModalities = 'audio';
		} else if (outPut === 'audio') {
			responseModalities = 'audio';
		} else {
			responseModalities = 'text';
		}

		const generationConfig = {
			...config?.generationConfig,
			speechConfig,
			responseModalities,
		} as typeof config.generationConfig;
		const systemInstruction = prompt
			? { parts: [{ text: prompt }] }
			: undefined;
		setConfig({ ...config, model: `models/${model}`, generationConfig, systemInstruction });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [connected, prompt, model, outPut, voice]);

	const panelStyle: React.CSSProperties = {
		background: colorFillAlter,
		borderRadius: borderRadiusLG,
		border: 'none',
	};

	const handleDisconnect = () => {
		setVideoStream(null);
		disconnect();
	};

	const handleConnect = async () => {
		try {
			await connect();
		} catch (err: any) {
			Modal.error({
				title: '连接失败',
				content:
					(err?.message || '无法连接到 Gemini Live 服务') +
					'。请检查网络、API Key（NEXT_PUBLIC_GEMINI_API_KEY）是否正确，并确认模型与权限配置无误。',
				okText: '好的',
			});
		}
	};

	return (
		<Layout
			style={{
				height: '100vh',
			}}
		>
			<Header
				style={{
					padding: '0 12px 0 24px',
					background: colorBgLayout,
					fontSize: 22,
					fontWeight: 500,
				}}
			>
				Stream Realtime
			</Header>
			<Flex
				style={{
					height: 'calc(100vh - 64px)',
					overflow: 'hidden',
				}}
			>
				<Content
					style={{
						background: colorBgContainer,
						borderRadius: 20,
						flex: 1,
						overflow: 'hidden',
					}}
				>
					<Flex style={{ height: '100%' }}>
						<Flex
							vertical
							flex={1}
							style={{
								borderRadius: 20,
								background: '#fff',
								position: 'relative',
								overflow: 'hidden',
							}}
						>
							<div className='px-5 py-2'>
								<Collapse
									bordered={false}
									style={{ background: colorBgContainer }}
									items={[
										{
											key: 'prompts',
											label: 'System Instructions',
											children: (
												<Input
													onChange={(e) =>
														setPrompt(
															e.target.value
														)
													}
													value={prompt}
													placeholder='Optional tone and style instructions for the model'
												/>
											),
											style: panelStyle,
										},
									]}
								/>
							</div>
							<div
								className='messages'
								style={{
									flex: 1,
									padding: 24,
									overflowY: 'auto',
									boxSizing: 'border-box',
									borderRadius: 20,
									height: 0,
								}}
							>
								<Flex gap='middle' vertical>
								{messages.map((m) => (
									<MessageItem key={m?.id} message={m} outputMode={outPut} />
								))}
								{/* 在Audio+Text模式下显示实时转写文字 */}
								{outPut === 'audio_text' && transcribedText && (
									<div
										style={{
											padding: '12px 16px',
											border: '1px dashed #d9d9d9',
											borderRadius: '8px',
											backgroundColor: '#f9f9f9',
											marginTop: '8px',
										}}
									>
										<div
											style={{
												fontSize: '12px',
												color: '#666',
												marginBottom: '4px',
											}}
										>
											🎤 实时语音转写
										</div>
										<div
											style={{
												fontSize: '14px',
												color: '#333',
												lineHeight: '1.5',
											}}
										>
											{transcribedText}
										</div>
									</div>
								)}
							</Flex>
							</div>
							<Flex justify='center'>
								<Button
									color='primary'
									variant={connected ? 'outlined' : 'solid'}
									onClick={connected ? handleDisconnect : handleConnect}
									icon={
										connected ? (
											<PauseCircleOutlined />
										) : (
											<PoweroffOutlined />
										)
									}
								>
									{connected
										? 'Disconnect'
										: 'Click me to start !'}
								</Button>
							</Flex>
							<div
								className='px-5 py-2'
								style={{
									pointerEvents: !connected ? 'none' : 'auto',
								}}
							>
								<Sender
									onChange={setTextInput}
									onSubmit={handleSubmit}
									value={textInput}
									disabled={!connected}
									prefix={
										<MediaButtons
											videoRef={videoRef}
											supportsVideo
											onVideoStreamChange={setVideoStream}
										/>
									}
								/>
								{videoStream ? (
									<video
										style={{
											position: 'absolute',
											top: 70,
											right: 20,
											maxWidth: 300,
											borderRadius: 10,
											border: '1px solid #333',
											display: !videoStream
												? 'none'
												: 'auto',
										}}
										ref={videoRef}
										autoPlay
										playsInline
									/>
								) : null}
							</div>
						</Flex>
					</Flex>
				</Content>
				<Flex
					vertical
					gap={32}
					style={{
						width: 250,
						padding: '10px',
						overflowY: 'auto',
						background: colorBgLayout,
					}}
				>
					<div
						style={{
							fontSize: 16,
							fontWeight: 500,
						}}
					>
						Run settings
					</div>
					<FieldItem
						label='Model'
						icon={<Image src={GeminiIcon} alt={'Model'} />}
					>
						<Select
							popupMatchSelectWidth={false}
							onChange={setModel}
							value={model}
							options={[
								{
									value: 'gemini-live-2.5-flash-preview',
									label: (
										<span>
											<span
												style={{
													marginRight: 8,
												}}
											>
												Gemini 2.5 Flash Live Preview
											</span>
											<Tag
												style={{
													marginRight: 0,
												}}
												color='#87d068'
											>
												New
											</Tag>
										</span>
									),
								},
							]}
						/>
					</FieldItem>
					<FieldItem label='Output format'>
						<Select
							onChange={setOutPut}
							value={outPut}
							options={[
								{
									value: 'audio',
									label: <span>Audio</span>,
								},
								{
									value: 'text',
									label: <span>Text</span>,
								},
								{
									value: 'audio_text',
									label: <span>Audio + Text</span>,
								},
							]}
						/>
					</FieldItem>
					<FieldItem label='Voice'>
						<Select
							onChange={setVoice}
							value={voice}
							options={[
								{
									value: 'Puck',
									label: <span>Puck</span>,
								},
								{
									value: 'Charon',
									label: <span>Charon</span>,
								},
								{
									value: 'Kore',
									label: <span>Kore</span>,
								},
								{
									value: 'Fenrir',
									label: <span>Fenrir</span>,
								},
								{
									value: 'Aoede',
									label: <span>Aoede</span>,
								},
							]}
						/>
					</FieldItem>
					<Collapse
						bordered={false}
						style={{ background: colorBgContainer }}
						activeKey={toolsPaneActive}
						onChange={(keys) =>
							setToolsPaneActive(keys as string[])
						}
						items={[
							{
								key: 'tools',
								label: 'Tools',
								children: (
									<Flex
										vertical
										gap={8}
										style={{
											paddingInlineStart: 24,
										}}
									>
										<FieldItem label='Code Execution'>
											<Checkbox
												onChange={(e) => {
													if (tools) {
														setTools({
															...tools,
															codeExecution:
																e.target
																	.checked,
														});
													}
												}}
												checked={tools?.codeExecution}
											/>
										</FieldItem>
										<FieldItem label='Function calling'>
											<Checkbox
												onChange={(e) => {
													if (tools) {
														setTools({
															...tools,
															functionCalling:
																e.target
																	.checked,
														});
													}
												}}
												checked={tools?.functionCalling}
											/>
										</FieldItem>
										<FieldItem label='Automatic Function Response'>
											<Checkbox
												onChange={(e) => {
													if (tools) {
														setTools({
															...tools,
															automaticFunctionResponse:
																e.target
																	.checked,
														});
													}
												}}
												checked={
													tools?.automaticFunctionResponse
												}
											/>
										</FieldItem>
										<FieldItem label='Grounding'>
												<Checkbox
													onChange={(e) => {
														if (tools) {
															setTools({
																...tools,
																grounding:
																	e.target
																		.checked,
															});
														}
													}}
													checked={tools?.grounding}
												/>
											</FieldItem>
											<FieldItem label='Speech to Text (Audio+Text mode)'>
															<Flex gap={8} align="center">
																<Checkbox
																	onChange={(e) => {
																		const checked = e.target.checked;
																		if (tools) {
																			setTools({
																				...tools,
																				speechToText: checked,
																			});
																			setSpeechToTextEnabled(checked);
																		}
																	}}
																	checked={tools?.speechToText}
																	disabled={outPut !== 'audio_text'}
																/>
																<Button 
																	size="small" 
																	onClick={() => {
																		console.log('🔍 调试信息:', {
																			outPut,
																			speechToTextEnabled: tools?.speechToText,
																			transcribedText,
																			connected
																		});
																	}}
																>
																	调试
																</Button>
															</Flex>
														</FieldItem>
									</Flex>
								),
								style: panelStyle,
							},
						]}
					/>
				</Flex>
			</Flex>
		</Layout>
	);
};

export default LivePage;

'use client';
import React from 'react';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import {
	RealtimeInputMessage,
	ClientContentMessage,
	ServerContentMessage,
} from '@/vendor/multimodal-live-types';
import { Part } from '@google/generative-ai';

type MessageType =
	| RealtimeInputMessage
	| ClientContentMessage
	| ServerContentMessage
	| null;

interface ChatExportProps {
	messages: MessageType[];
	disabled?: boolean;
}

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

const ChatExport: React.FC<ChatExportProps> = ({ messages, disabled = false }) => {
	const formatMessagesToMarkdown = (messages: MessageType[]): string => {
		const validMessages = messages.filter((msg) => msg !== null);
		
		if (validMessages.length === 0) {
			return '# 对话记录\n\n暂无对话内容。';
		}

		const now = new Date();
		const timestamp = now.toLocaleString('zh-CN', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});

		let markdown = `# 对话记录\n\n**导出时间**: ${timestamp}\n\n---\n\n`;

		validMessages.forEach((message, index) => {
			if (isClientMessage(message)) {
				// 用户消息
				const content = message.clientContent.turns?.[0]?.parts
					.map((p) => p.text)
					.filter(Boolean)
					.join('');
				
				if (content) {
					markdown += `## 👤 用户\n\n${content}\n\n`;
				}
			} else if (isServerMessage(message) && hasModelTurn(message.serverContent)) {
				// AI消息
				const content = message.serverContent.modelTurn.parts
					.map((p) => p?.text ?? '')
					.filter(Boolean)
					.join('');
				
				if (content) {
					markdown += `## 🤖 AI助手\n\n${content}\n\n`;
				}
			}
			
			// 在消息之间添加分隔线（除了最后一条消息）
			if (index < validMessages.length - 1) {
				markdown += '---\n\n';
			}
		});

		markdown += `\n\n---\n\n*此对话记录由 Gemini Next Web 导出*`;
		return markdown;
	};

	const handleExport = () => {
		const markdown = formatMessagesToMarkdown(messages);
		
		// 创建下载文件
		const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		
		// 生成文件名（包含时间戳）
		const now = new Date();
		const dateStr = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
		const filename = `chat-export-${dateStr}.md`;
		
		// 创建下载链接并触发下载
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		
		// 清理URL对象
		URL.revokeObjectURL(url);
	};

	return (
		<Button
			type="default"
			icon={<DownloadOutlined />}
			onClick={handleExport}
			disabled={disabled || messages.filter(msg => msg !== null).length === 0}
			size="small"
		>
			导出对话
		</Button>
	);
};

export default ChatExport;
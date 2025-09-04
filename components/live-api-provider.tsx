'use client';

import React, { useEffect } from 'react';
import { LiveAPIProvider as Provider } from '@/vendor/contexts/LiveAPIContext';
import { Modal } from 'antd';

const LiveAPIProvider = ({ children }: { children: React.ReactNode }) => {
	const host = 'generativelanguage.googleapis.com';
	const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

	const API_KEY = (process.env.NEXT_PUBLIC_GEMINI_API_KEY as string) || '';

	useEffect(() => {
		if (!API_KEY) {
			Modal.error({
				title: '缺少 API Key',
				content:
					'请在 .env 中设置 NEXT_PUBLIC_GEMINI_API_KEY=你的密钥，并重启开发服务器（npm run dev）。',
				okText: '我知道了',
			});
		}
	}, [API_KEY]);

	return <Provider url={uri} apiKey={API_KEY}>{children}</Provider>;
};

export default LiveAPIProvider;

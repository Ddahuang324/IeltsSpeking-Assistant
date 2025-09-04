'use client';
import React, { useState } from 'react';
import {
	Layout,
	Flex,
	theme,
	Button,
	Input,
	Card,
	Spin,
	Alert,
	Tag,
	Typography,
	Space,
	Progress,
	Modal,
	Row,
	Col,
	Statistic,
} from 'antd';
import {
	ClearOutlined,
	FileTextOutlined,
	BulbOutlined,
	TagsOutlined,
	MehOutlined,
	FrownOutlined,
	SmileOutlined,
	BookOutlined,
	CheckCircleOutlined,
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { TextArea } = Input;
const { Text } = Typography;

interface SemanticAnalysisResult {
	entities: Array<{
		text: string;
		label: string;
		description: string;
		start: number;
		end: number;
		confidence: number;
	}>;
	dependencies: Array<{
		text: string;
		dep: string;
		dep_description: string;
		head: string;
		children: string[];
	}>;
	pos_tags: Array<{
		text: string;
		pos: string;
		pos_description: string;
		tag: string;
		tag_description: string;
		lemma: string;
		is_alpha: boolean;
		is_stop: boolean;
		is_punct: boolean;
	}>;
	noun_phrases: Array<{
		text: string;
		root: string;
		root_dep: string;
		start: number;
		end: number;
	}>;
	sentiment: {
		sentiment: string;
		score: number;
		positive_words: number;
		negative_words: number;
	};
	similarity: {
		average_similarity: number;
		similarities: Array<{
			sentence1: string;
			sentence2: string;
			similarity: number;
		}>;
	};
	tokens: Array<{
		text: string;
		lemma: string;
		pos: string;
		tag: string;
		dep: string;
		shape: string;
		is_alpha: boolean;
		is_stop: boolean;
		is_punct: boolean;
		is_space: boolean;
		like_num: boolean;
		like_email: boolean;
		like_url: boolean;
	}>;
	analysis_timestamp: string;
}

const SemanticPage: React.FC = () => {
	const {
		token: { colorBgLayout, colorBgContainer },
	} = theme.useToken();

	const [inputText, setInputText] = useState<string>('');
	const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
	const [result, setResult] = useState<SemanticAnalysisResult | null>(null);
	const [error, setError] = useState<string>('');
	const [history, setHistory] = useState<Array<{ text: string; result: SemanticAnalysisResult }>>([]);

	// 语义分析API调用
	const analyzeText = async (text: string): Promise<SemanticAnalysisResult> => {
		try {
			const response = await fetch('http://localhost:5002/semantic', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ text })
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			return result;
		} catch (error) {
			console.error('Analysis error:', error);
			throw new Error('分析服务暂时不可用，请稍后重试');
		}
	};

	const handleAnalyze = async () => {
		if (!inputText.trim()) {
			Modal.warning({
				title: '提示',
				content: '请输入要分析的文本内容',
				okText: '确定',
			});
			return;
		}

		setIsAnalyzing(true);
		setError('');
		setResult(null);

		try {
			const analysisResult = await analyzeText(inputText);
			setResult(analysisResult);
			
			// 添加到历史记录
			setHistory(prev => [{ text: inputText, result: analysisResult }, ...prev.slice(0, 4)]);
		} catch {
			setError('分析失败，请重试');
		} finally {
			setIsAnalyzing(false);
		}
	};

	const handleClear = () => {
		setInputText('');
		setResult(null);
		setError('');
	};

	return (
		<Layout style={{ height: '100vh' }}>
			<Header
				style={{
					padding: '0 12px 0 24px',
					background: colorBgLayout,
					fontSize: 22,
					fontWeight: 500,
				}}
			>
				语义分析
			</Header>
			<Content
				style={{
					padding: '24px',
					background: colorBgContainer,
					height: 'calc(100vh - 64px)',
					overflow: 'auto',
				}}
			>
				<Flex gap={24} style={{ height: '100%' }}>
					{/* 左侧输入区域 */}
					<Card
						title={
							<Space>
								<FileTextOutlined />
								文本输入
							</Space>
						}
						style={{ flex: 1, height: 'fit-content' }}
					>
						<Space direction="vertical" style={{ width: '100%' }} size="large">
							<TextArea
								value={inputText}
								onChange={(e) => setInputText(e.target.value)}
								placeholder="请输入要进行语义分析的文本内容..."
								rows={8}
								maxLength={1000}
								showCount
							/>
							<Flex gap={12}>
								<Button
									type="primary"
									icon={<BulbOutlined />}
									onClick={handleAnalyze}
									loading={isAnalyzing}
									disabled={!inputText.trim()}
								>
									开始分析
								</Button>
								<Button
									icon={<ClearOutlined />}
									onClick={handleClear}
								>
									清空
								</Button>
							</Flex>
							{error && (
								<Alert
									message={error}
									type="error"
									showIcon
									closable
									onClose={() => setError('')}
								/>
							)}
						</Space>
					</Card>

					{/* 右侧结果区域 */}
					<div style={{ flex: 1 }}>
						{isAnalyzing && (
							<Card>
								<Flex justify="center" align="center" style={{ height: 200 }}>
									<Space direction="vertical" align="center">
										<Spin size="large" />
										<Text>正在进行语义分析...</Text>
									</Space>
								</Flex>
							</Card>
						)}

						{result && (
					<Space direction="vertical" style={{ width: '100%' }} size="large">
						{/* 情感分析结果 */}
						<Card title="情感分析" size="small">
							<Flex align="center" gap={16}>
								<div style={{ 
									color: result.sentiment.sentiment === 'positive' ? '#52c41a' : 
										   result.sentiment.sentiment === 'negative' ? '#ff4d4f' : '#faad14', 
									fontSize: 24 
								}}>
									{result.sentiment.sentiment === 'positive' ? <SmileOutlined /> : 
									 result.sentiment.sentiment === 'negative' ? <FrownOutlined /> : <MehOutlined />}
								</div>
								<div style={{ flex: 1 }}>
									<Text strong style={{ 
										color: result.sentiment.sentiment === 'positive' ? '#52c41a' : 
											   result.sentiment.sentiment === 'negative' ? '#ff4d4f' : '#faad14'
									}}>
										{result.sentiment.sentiment === 'positive' ? '积极' : 
										 result.sentiment.sentiment === 'negative' ? '消极' : '中性'}
									</Text>
									<Progress
										percent={Math.round(result.sentiment.score * 100)}
										strokeColor={result.sentiment.sentiment === 'positive' ? '#52c41a' : 
													 result.sentiment.sentiment === 'negative' ? '#ff4d4f' : '#faad14'}
										size="small"
										style={{ marginTop: 4 }}
									/>
									<Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
										积极词汇: {result.sentiment.positive_words} | 消极词汇: {result.sentiment.negative_words}
									</Text>
								</div>
							</Flex>
						</Card>

						{/* 命名实体识别 */}
						{result.entities.length > 0 && (
							<Card title="命名实体识别" size="small">
								<Space wrap>
									{result.entities.map((entity, index) => (
										<Tag key={index} color="blue" title={entity.description}>
											{entity.text} ({entity.label})
										</Tag>
									))}
								</Space>
							</Card>
						)}

						{/* 名词短语 */}
						{result.noun_phrases.length > 0 && (
							<Card title="名词短语" size="small">
								<Space wrap>
									{result.noun_phrases.map((phrase, index) => (
										<Tag key={index} color="green">
											{phrase.text}
										</Tag>
									))}
								</Space>
							</Card>
						)}

						{/* 句子相似度 */}
						{result.similarity.similarities.length > 0 && (
							<Card title="句子相似度分析" size="small">
								<div style={{ marginBottom: 12 }}>
									<Text strong>平均相似度: </Text>
									<Progress 
										percent={Math.round(result.similarity.average_similarity * 100)} 
										strokeColor="#1890ff"
										size="small"
										style={{ width: 200 }}
									/>
								</div>
								<Space direction="vertical" style={{ width: '100%' }}>
									{result.similarity.similarities.slice(0, 3).map((sim, index) => (
										<div key={index} style={{ padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
											<Text ellipsis style={{ display: 'block', fontSize: 12 }}>
												&ldquo;{sim.sentence1}&rdquo;
											</Text>
											<Text ellipsis style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
												&ldquo;{sim.sentence2}&rdquo;
											</Text>
											<Tag color="blue">相似度: {(sim.similarity * 100).toFixed(1)}%</Tag>
										</div>
									))}
								</Space>
							</Card>
						)}

						{/* 词性标注统计 */}
						<Card title="词性分析" size="small">
							<Row gutter={16}>
								<Col span={8}>
									<Statistic 
										title="名词" 
										value={result.pos_tags.filter(tag => tag.pos === 'NOUN').length}
										prefix={<BookOutlined />}
									/>
								</Col>
								<Col span={8}>
									<Statistic 
										title="动词" 
										value={result.pos_tags.filter(tag => tag.pos === 'VERB').length}
										prefix={<CheckCircleOutlined />}
									/>
								</Col>
								<Col span={8}>
									<Statistic 
										title="形容词" 
										value={result.pos_tags.filter(tag => tag.pos === 'ADJ').length}
										prefix={<TagsOutlined />}
									/>
								</Col>
							</Row>
						</Card>
					</Space>
				)}

						{!isAnalyzing && !result && (
							<Card>
								<Flex justify="center" align="center" style={{ height: 200 }}>
									<Space direction="vertical" align="center">
										<BulbOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
										<Text type="secondary">请输入文本并点击&quot;开始分析&quot;</Text>
									</Space>
								</Flex>
							</Card>
						)}

						{/* 历史记录 */}
						{history.length > 0 && (
							<Card title="分析历史" size="small">
								<Space direction="vertical" style={{ width: '100%' }}>
									{history.map((item, index) => (
										<div key={index} style={{ padding: 8, background: '#fafafa', borderRadius: 4 }}>
											<Text ellipsis style={{ display: 'block', marginBottom: 4 }}>
												{item.text}
											</Text>
											<Tag color={
												item.result.sentiment.sentiment === 'positive' ? 'green' : 
												item.result.sentiment.sentiment === 'negative' ? 'red' : 'orange'
											}>
												{item.result.sentiment.sentiment === 'positive' ? '积极' : 
												 item.result.sentiment.sentiment === 'negative' ? '消极' : '中性'}
											</Tag>
											<Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
												实体: {item.result.entities.length} | 名词短语: {item.result.noun_phrases.length}
											</Text>
										</div>
									))}
								</Space>
							</Card>
						)}
					</div>
				</Flex>
			</Content>
		</Layout>
	);
};

export default SemanticPage;
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
	Modal,
	Row,
	Col,
	Statistic,
	Collapse,
	List,
	Badge,
	Tooltip,
} from 'antd';
import {
	ClearOutlined,
	FileTextOutlined,
	BulbOutlined,
	CheckCircleOutlined,
	ExclamationCircleOutlined,
	WarningOutlined,
	InfoCircleOutlined,
	TrophyOutlined,
	BookOutlined,
	SoundOutlined,
	EditOutlined,
	EyeOutlined,
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { TextArea } = Input;
const { Text } = Typography;
const { Panel } = Collapse;

// 雅思口语分析结果接口
interface IELTSAnalysisResult {
	overall_feedback: {
		strengths: string[];
		areas_for_improvement: string[];
		key_recommendations: string[];
	};
	ielts_band_score: {
		fluency_and_coherence: {
			score: number;
			rationale: string;
		};
		lexical_resource: {
			score: number;
			rationale: string;
		};
		grammatical_range_and_accuracy: {
			score: number;
			rationale: string;
		};
		pronunciation_assumption: {
			score: number;
			rationale: string;
		};
		overall: {
			score: number;
			rationale: string;
		};
	};
	grammar_errors: Array<{
		type: string;
		text: string;
		description: string;
		suggestions: string[];
	}>;
	word_choice_issues: Array<{
		type: string;
		text: string;
		suggestion: string;
	}>;
	tense_consistency: {
		analysis: string;
	};
	sentence_structure: {
		analysis: string;
		issues: Array<{
			sentence: string;
			issue: string;
		}>;
	};
	vocabulary_assessment: {
		lexical_density: number;
		advanced_words_found: string[];
		overused_basic_words: string[];
		vocabulary_suggestions: Array<{
			basic_word: string;
			alternatives: string[];
		}>;
	};
	fluency_markers: {
		hesitation_markers: Array<{
			marker: string;
			count: number;
		}>;
		connectors_used: string[];
	};
	analysis_timestamp?: number;
	analysis_duration_seconds?: number;
}

const IELTSPage: React.FC = () => {
	const {
		token: { colorBgLayout, colorBgContainer },
	} = theme.useToken();

	const [inputText, setInputText] = useState<string>('');
	const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
	const [result, setResult] = useState<IELTSAnalysisResult | null>(null);
	const [error, setError] = useState<string>('');
	const [, setHistory] = useState<Array<{ text: string; result: IELTSAnalysisResult }>>([]);

	// 雅思口语分析API调用
	const analyzeIELTSText = async (text: string): Promise<IELTSAnalysisResult> => {
		try {
			// 创建临时的Markdown文件内容
			const blob = new Blob([text], { type: 'text/markdown' });
			const formData = new FormData();
			formData.append('file', blob, 'speech.md');

			const response = await fetch('http://localhost:5002/ielts-speaking-gemini', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			return result;
		} catch (error) {
			console.error('IELTS Analysis error:', error);
			throw new Error('雅思分析服务暂时不可用，请稍后重试');
		}
	};

	const handleAnalyze = async () => {
		if (!inputText.trim()) {
			Modal.warning({
				title: '提示',
				content: '请输入要分析的英语口语文本内容',
				okText: '确定',
			});
			return;
		}

		setIsAnalyzing(true);
		setError('');
		setResult(null);

		try {
			const analysisResult = await analyzeIELTSText(inputText);
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

	// 获取错误严重程度的颜色
	const getErrorSeverityColor = (type: string) => {
		switch (type.toLowerCase()) {
			case 'grammar':
			case 'misspelling':
				return 'red';
			case 'style':
			case 'redundancy':
				return 'orange';
			default:
				return 'blue';
		}
	};

	// 获取IELTS总体评分
	const calculateOverallScore = (result: IELTSAnalysisResult) => {
		return result.ielts_band_score.overall.score;
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
				雅思口语分析
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
								英语口语文本输入
							</Space>
						}
						style={{ flex: 1, height: 'fit-content' }}
					>
						<Space direction="vertical" style={{ width: '100%' }} size="large">
							<TextArea
								value={inputText}
								onChange={(e) => setInputText(e.target.value)}
								placeholder="请输入要进行雅思口语分析的英语文本内容...\n\n例如：\nI think that technology has changed our lives in many ways. For example, we can now communicate with people from all over the world using social media platforms. However, I believe that sometimes technology can also have negative effects on our relationships."
								rows={10}
								maxLength={2000}
								showCount
							/>
							<Flex gap={12}>
								<Button
									type="primary"
									icon={<BulbOutlined />}
									onClick={handleAnalyze}
									loading={isAnalyzing}
									disabled={!inputText.trim()}
									size="large"
								>
									开始分析
								</Button>
								<Button
									icon={<ClearOutlined />}
									onClick={handleClear}
									size="large"
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
										<Text>正在进行雅思口语分析...</Text>
									</Space>
								</Flex>
							</Card>
						)}

						{result && (
							<Space direction="vertical" style={{ width: '100%' }} size="large">
								{/* 总体评分 */}
								<Card 
									title={
										<Space>
											<TrophyOutlined style={{ color: '#faad14' }} />
											总体评估
										</Space>
									}
									size="small"
								>
									<Row gutter={16}>
										<Col span={6}>
											<Statistic
												title="IELTS总分"
												value={calculateOverallScore(result)}
												suffix="/ 9"
												valueStyle={{ color: calculateOverallScore(result) >= 7 ? '#3f8600' : calculateOverallScore(result) >= 5.5 ? '#faad14' : '#cf1322' }}
											/>
										</Col>
										<Col span={6}>
											<Statistic
												title="流利度与连贯性"
												value={result.ielts_band_score.fluency_and_coherence.score}
												suffix="/ 9"
												valueStyle={{ color: result.ielts_band_score.fluency_and_coherence.score >= 7 ? '#3f8600' : result.ielts_band_score.fluency_and_coherence.score >= 5.5 ? '#faad14' : '#cf1322' }}
											/>
										</Col>
										<Col span={6}>
											<Statistic
												title="词汇资源"
												value={result.ielts_band_score.lexical_resource.score}
												suffix="/ 9"
												valueStyle={{ color: result.ielts_band_score.lexical_resource.score >= 7 ? '#3f8600' : result.ielts_band_score.lexical_resource.score >= 5.5 ? '#faad14' : '#cf1322' }}
											/>
										</Col>
										<Col span={6}>
											<Statistic
												title="语法范围与准确性"
												value={result.ielts_band_score.grammatical_range_and_accuracy.score}
												suffix="/ 9"
												valueStyle={{ color: result.ielts_band_score.grammatical_range_and_accuracy.score >= 7 ? '#3f8600' : result.ielts_band_score.grammatical_range_and_accuracy.score >= 5.5 ? '#faad14' : '#cf1322' }}
											/>
										</Col>
									</Row>
									<Row gutter={16} style={{ marginTop: 16 }}>
										<Col span={6}>
											<Statistic
												title="发音（假设）"
												value={result.ielts_band_score.pronunciation_assumption.score}
												suffix="/ 9"
												valueStyle={{ color: result.ielts_band_score.pronunciation_assumption.score >= 7 ? '#3f8600' : result.ielts_band_score.pronunciation_assumption.score >= 5.5 ? '#faad14' : '#cf1322' }}
											/>
										</Col>
										<Col span={6}>
											<Statistic
												title="语法错误"
												value={result.grammar_errors.length}
												suffix="个"
												valueStyle={{ color: result.grammar_errors.length === 0 ? '#3f8600' : result.grammar_errors.length <= 2 ? '#faad14' : '#cf1322' }}
											/>
										</Col>
										<Col span={6}>
											<Statistic
												title="词汇密度"
												value={Math.round(result.vocabulary_assessment.lexical_density * 100)}
												suffix="%"
												valueStyle={{ color: result.vocabulary_assessment.lexical_density >= 0.7 ? '#3f8600' : '#faad14' }}
											/>
										</Col>
										<Col span={6}>
											<Statistic
												title="高级词汇"
												value={result.vocabulary_assessment.advanced_words_found.length}
												suffix="个"
												valueStyle={{ color: result.vocabulary_assessment.advanced_words_found.length >= 5 ? '#3f8600' : '#faad14' }}
											/>
										</Col>
									</Row>
								</Card>

								{/* 综合反馈 */}
								<Card 
									title={
										<Space>
											<BulbOutlined style={{ color: '#1890ff' }} />
											综合反馈
										</Space>
									}
									size="small"
								>
									<Collapse ghost>
										<Panel 
											header={
												<Space>
													<CheckCircleOutlined style={{ color: '#52c41a' }} />
													优势 ({result.overall_feedback.strengths.length})
												</Space>
											} 
											key="1"
										>
											<List
												dataSource={result.overall_feedback.strengths}
												renderItem={(item) => (
													<List.Item>
														<Text><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{item}</Text>
													</List.Item>
												)}
											/>
										</Panel>
										<Panel 
											header={
												<Space>
													<ExclamationCircleOutlined style={{ color: '#faad14' }} />
													需要改进的地方 ({result.overall_feedback.areas_for_improvement.length})
												</Space>
											} 
											key="2"
										>
											<List
												dataSource={result.overall_feedback.areas_for_improvement}
												renderItem={(item) => (
													<List.Item>
														<Text><ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />{item}</Text>
													</List.Item>
												)}
											/>
										</Panel>
										<Panel 
											header={
												<Space>
													<BulbOutlined style={{ color: '#1890ff' }} />
													关键建议 ({result.overall_feedback.key_recommendations.length})
												</Space>
											} 
											key="3"
										>
											<List
												dataSource={result.overall_feedback.key_recommendations}
												renderItem={(item) => (
													<List.Item>
														<Text><BulbOutlined style={{ color: '#1890ff', marginRight: 8 }} />{item}</Text>
													</List.Item>
												)}
											/>
										</Panel>
									</Collapse>
								</Card>

								{/* 语法错误 */}
								{result.grammar_errors.length > 0 && (
									<Card 
										title={
											<Space>
												<WarningOutlined style={{ color: '#ff4d4f' }} />
												语法错误 ({result.grammar_errors.length})
											</Space>
										}
										size="small"
									>
										<List
											dataSource={result.grammar_errors}
											renderItem={(error) => (
												<List.Item>
													<Space direction="vertical" style={{ width: '100%' }}>
														<Flex justify="space-between" align="center">
															<Space>
																<Badge color={getErrorSeverityColor(error.type)} />
																<Text strong>&quot;{error.text}&quot;</Text>
																<Tag color={getErrorSeverityColor(error.type)}>{error.type}</Tag>
															</Space>
														</Flex>
														<Text type="secondary">{error.description}</Text>
														{error.suggestions.length > 0 && (
															<div>
																<Text strong>建议: </Text>
																{error.suggestions.map((suggestion, index) => (
																	<Tag key={index} color="green" style={{ margin: '2px' }}>
																		{suggestion}
																	</Tag>
																))}
															</div>
														)}
													</Space>
												</List.Item>
											)}
										/>
									</Card>
								)}

								{/* 用词问题 */}
								{result.word_choice_issues.length > 0 && (
									<Card 
										title={
											<Space>
												<EditOutlined style={{ color: '#faad14' }} />
												用词问题 ({result.word_choice_issues.length})
											</Space>
										}
										size="small"
									>
										<List
											dataSource={result.word_choice_issues}
											renderItem={(issue) => (
												<List.Item>
													<Space direction="vertical" style={{ width: '100%' }}>
														<Flex justify="space-between" align="center">
															<Text strong>&quot;{issue.text}&quot;</Text>
															<Tag color="orange">{issue.type}</Tag>
														</Flex>
														<Text type="secondary">{issue.suggestion}</Text>
													</Space>
												</List.Item>
											)}
										/>
									</Card>
								)}

								{/* 句子结构分析 */}
								{result.sentence_structure.issues.length > 0 && (
									<Card 
										title={
											<Space>
												<InfoCircleOutlined style={{ color: '#1890ff' }} />
												句子结构问题 ({result.sentence_structure.issues.length})
											</Space>
										}
										size="small"
									>
										<List
											dataSource={result.sentence_structure.issues}
											renderItem={(issue) => (
												<List.Item>
													<Space direction="vertical" style={{ width: '100%' }}>
														<Text strong>&quot;{issue.sentence}&quot;</Text>
														<Text type="secondary">{issue.issue}</Text>
													</Space>
												</List.Item>
											)}
										/>
									</Card>
								)}

								{/* 词汇评估 */}
								<Card 
									title={
										<Space>
											<BookOutlined style={{ color: '#52c41a' }} />
											词汇评估
										</Space>
									}
									size="small"
								>
									<Collapse ghost>
										<Panel 
											header={`高级词汇 (${result.vocabulary_assessment.advanced_words_found.length}个)`} 
											key="1"
										>
											<Space wrap>
												{result.vocabulary_assessment.advanced_words_found.map((word, index) => (
													<Tag key={index} color="green">{word}</Tag>
												))}
											</Space>
										</Panel>
										{result.vocabulary_assessment.overused_basic_words.length > 0 && (
											<Panel 
												header={`过度使用的基础词汇 (${result.vocabulary_assessment.overused_basic_words.length}个)`} 
												key="2"
											>
												<Space wrap>
													{result.vocabulary_assessment.overused_basic_words.map((word, index) => (
														<Tag key={index} color="orange">{word}</Tag>
													))}
												</Space>
											</Panel>
										)}
										{result.vocabulary_assessment.vocabulary_suggestions.length > 0 && (
											<Panel 
												header={`词汇建议 (${result.vocabulary_assessment.vocabulary_suggestions.length}个)`} 
												key="3"
											>
												<List
													dataSource={result.vocabulary_assessment.vocabulary_suggestions}
													renderItem={(suggestion) => (
														<List.Item>
															<Space direction="vertical" style={{ width: '100%' }}>
																<Text strong>替换 &quot;{suggestion.basic_word}&quot;:</Text>
																<Space wrap>
																	{suggestion.alternatives.map((alt, index) => (
																		<Tag key={index} color="blue">{alt}</Tag>
																	))}
																</Space>
															</Space>
														</List.Item>
													)}
												/>
											</Panel>
										)}
									</Collapse>
								</Card>

								{/* 流利度分析 */}
								<Card 
									title={
										<Space>
											<SoundOutlined style={{ color: '#722ed1' }} />
											流利度分析
										</Space>
									}
									size="small"
								>
									<Row gutter={16}>
										<Col span={12}>
											<div>
												<Text strong>犹豫标记:</Text>
												<div style={{ marginTop: 8 }}>
													{result.fluency_markers.hesitation_markers.length > 0 ? (
														<Space wrap>
															{result.fluency_markers.hesitation_markers.map((marker, index) => (
																<Tooltip key={index} title={`出现 ${marker.count} 次`}>
																	<Badge count={marker.count} size="small">
																		<Tag color="red">{marker.marker}</Tag>
																	</Badge>
																</Tooltip>
															))}
														</Space>
													) : (
														<Text type="secondary">未检测到犹豫标记</Text>
													)}
												</div>
											</div>
										</Col>
										<Col span={12}>
											<div>
												<Text strong>连接词使用:</Text>
												<div style={{ marginTop: 8 }}>
													{result.fluency_markers.connectors_used.length > 0 ? (
														<Space wrap>
															{result.fluency_markers.connectors_used.map((connector, index) => (
																<Tag key={index} color="green">{connector}</Tag>
															))}
														</Space>
													) : (
														<Text type="secondary">未使用高级连接词</Text>
													)}
												</div>
											</div>
										</Col>
									</Row>
								</Card>

								{/* 时态一致性 */}
								<Card 
									title={
										<Space>
											<EyeOutlined style={{ color: '#13c2c2' }} />
											时态使用情况
										</Space>
									}
									size="small"
								>
									<div style={{ marginBottom: 16 }}>
										<Text>{result.tense_consistency.analysis}</Text>
									</div>
								</Card>
							</Space>
						)}
					</div>
				</Flex>
			</Content>
		</Layout>
	);
};

export default IELTSPage;
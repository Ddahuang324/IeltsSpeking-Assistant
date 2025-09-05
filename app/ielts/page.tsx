'use client';
import React, { useState } from 'react';
import {
	Layout,
	Flex,
	theme,
	Button,
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
	Upload,
} from 'antd';
import { Sender } from '@ant-design/x';
import {
	ClearOutlined,
	FileTextOutlined,
	BulbOutlined,
	CheckCircleOutlined,
	ExclamationCircleOutlined,
	WarningOutlined,
	TrophyOutlined,
	BookOutlined,
	SoundOutlined,
	EditOutlined,
	UploadOutlined,
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Text } = Typography;
const { Panel } = Collapse;

// 雅思口语分析结果接口
interface IELTSAnalysisResult {
	overall_feedback: {
		strengths: Array<{
			point: string;
			example: string;
		}>;
		areas_for_improvement: Array<{
			point: string;
			example: string;
		}>;
		key_recommendations: Array<{
			point: string;
			example: string;
		}>;
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
		pronunciation: {
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
		original_sentence: string;
		text: string;
		description: string;
		suggestions: string[];
	}>;
	word_choice_issues: Array<{
		type: string;
		original_sentence: string;
		text: string;
		suggestion: string;
	}>;
	vocabulary_assessment: {
		advanced_words_found: string[];
		vocabulary_suggestions: Array<{
			overused_word: string;
			original_sentence: string;
			suggested_rewrites: string[];
		}>;
	};
	fluency_markers: {
		analysis: string;
		hesitation_markers: Array<{
			marker: string;
			count: number;
		}>;
		connectors_used: string[];
	};
	pronunciation_analysis: {
		analysis: string;
		potential_patterns: Array<{
			suspected_issue: string;
			evidence: string[];
		}>;
	};
	analysis_timestamp?: number;
	analysis_duration_seconds?: number;
}

const IELTSPage: React.FC = () => {
	const {
		token: { colorBgLayout, colorBgContainer },
	} = theme.useToken();

	const [textInput, setTextInput] = useState<string>('');
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

	// 文件上传处理函数
	const handleFileUpload = async (file: File): Promise<boolean> => {
		try {
			// 检查文件类型
			if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
				Modal.error({
					title: '文件格式错误',
					content: '请上传 .md 或 .txt 格式的文件',
					okText: '确定',
				});
				return false;
			}

			// 读取文件内容
			const text = await file.text();
			if (!text.trim()) {
				Modal.error({
					title: '文件内容为空',
					content: '请上传包含英语口语文本的文件',
					okText: '确定',
				});
				return false;
			}

			// 设置文本内容并开始分析
			setTextInput(text);
			await handleSubmit(text);
			return false; // 阻止默认上传行为
		} catch (error) {
			console.error('File upload error:', error);
			Modal.error({
				title: '文件读取失败',
				content: '无法读取文件内容，请重试',
				okText: '确定',
			});
			return false;
		}
	};



	const handleSubmit = async (value: string) => {
		if (!value.trim()) {
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
			const analysisResult = await analyzeIELTSText(value);
			setResult(analysisResult);
			
			// 添加到历史记录
			setHistory(prev => [{ text: value, result: analysisResult }, ...prev.slice(0, 4)]);
			
			// 清空输入框
			setTextInput('');
		} catch {
			setError('分析失败，请重试');
		} finally {
			setIsAnalyzing(false);
		}
	};

	const handleClear = () => {
		setTextInput('');
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
				<div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
					{/* 上方分析结果区域 - 两栏布局 */}
					<div style={{ flex: 1, marginBottom: 24 }}>
						{!result && !isAnalyzing && (
							<Card style={{ height: '100%' }}>
								<Flex justify="center" align="center" style={{ height: '100%' }}>
									<Space direction="vertical" align="center">
										<FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
										<Text type="secondary" style={{ fontSize: 16 }}>请在下方输入英语口语文本进行分析</Text>
									</Space>
								</Flex>
							</Card>
						)}

						{isAnalyzing && (
							<Card style={{ height: '100%' }}>
								<Flex justify="center" align="center" style={{ height: '100%' }}>
									<Space direction="vertical" align="center">
										<Spin size="large" />
										<Text>正在进行雅思口语分析...</Text>
									</Space>
								</Flex>
							</Card>
						)}

						{result && (
							<Row gutter={24} style={{ height: '100%' }}>
								{/* 左栏 - 评分和反馈 */}
								<Col span={12}>
									<div style={{ height: '100%', overflowY: 'auto', paddingRight: 8 }}>
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
													<Col span={12}>
														<Statistic
															title="IELTS总分"
															value={calculateOverallScore(result)}
															suffix="/ 9"
															valueStyle={{ color: calculateOverallScore(result) >= 7 ? '#3f8600' : calculateOverallScore(result) >= 5.5 ? '#faad14' : '#cf1322' }}
														/>
													</Col>
													<Col span={12}>
														<Statistic
															title="流利度与连贯性"
															value={result.ielts_band_score.fluency_and_coherence.score}
															suffix="/ 9"
															valueStyle={{ color: result.ielts_band_score.fluency_and_coherence.score >= 7 ? '#3f8600' : result.ielts_band_score.fluency_and_coherence.score >= 5.5 ? '#faad14' : '#cf1322' }}
														/>
													</Col>
												</Row>
												<Row gutter={16} style={{ marginTop: 16 }}>
													<Col span={12}>
														<Statistic
															title="词汇资源"
															value={result.ielts_band_score.lexical_resource.score}
															suffix="/ 9"
															valueStyle={{ color: result.ielts_band_score.lexical_resource.score >= 7 ? '#3f8600' : result.ielts_band_score.lexical_resource.score >= 5.5 ? '#faad14' : '#cf1322' }}
														/>
													</Col>
													<Col span={12}>
														<Statistic
															title="语法范围与准确性"
															value={result.ielts_band_score.grammatical_range_and_accuracy.score}
															suffix="/ 9"
															valueStyle={{ color: result.ielts_band_score.grammatical_range_and_accuracy.score >= 7 ? '#3f8600' : result.ielts_band_score.grammatical_range_and_accuracy.score >= 5.5 ? '#faad14' : '#cf1322' }}
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
																						<div>
																							<Text><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{item.point}</Text>
																							{item.example && (
																								<div style={{ marginTop: 4, marginLeft: 24 }}>
																									<Text type="secondary" style={{ fontStyle: 'italic' }}>例子: &quot;{item.example}&quot;</Text>
																								</div>
																							)}

																						</div>
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
																						<div>
																							<Text><ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />{item.point}</Text>
																							{item.example && (
																								<div style={{ marginTop: 4, marginLeft: 24 }}>
																									<Text type="secondary" style={{ fontStyle: 'italic' }}>例子: &quot;{item.example}&quot;</Text>
																								</div>
																							)}
																						</div>
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
																						<div>
																							<Text><BulbOutlined style={{ color: '#1890ff', marginRight: 8 }} />{item.point}</Text>
																							{item.example && (
																								<div style={{ marginTop: 4, marginLeft: 24 }}>
																									<Text type="secondary" style={{ fontStyle: 'italic' }}>例子: &quot;{item.example}&quot;</Text>
																								</div>
																							)}
																						</div>
																					</List.Item>
																				)}
																			/>
													</Panel>
												</Collapse>
											</Card>

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
																	<Panel 
																				header={`词汇建议 (${result.vocabulary_assessment.vocabulary_suggestions.length}个)`} 
																				key="2"
																			>
																				<List
																					dataSource={result.vocabulary_assessment.vocabulary_suggestions}
																					renderItem={(suggestion) => (
																						<List.Item>
																							<div>
																								<Text><Tag color="orange">{suggestion.overused_word}</Tag> 在句子中过度使用</Text>
																								<div style={{ marginTop: 4, marginLeft: 8 }}>
																									<Text type="secondary">原句: &quot;{suggestion.original_sentence}&quot;</Text>
																								</div>
																								<div style={{ marginTop: 4, marginLeft: 8 }}>
																									<Text strong>建议改写: </Text>
																									<Space wrap>
																										{suggestion.suggested_rewrites.map((rewrite, index) => (
																											<Tag key={index} color="green">{rewrite}</Tag>
																										))}
																									</Space>
																								</div>
																							</div>
																						</List.Item>
																					)}
																				/>
																			</Panel>
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
																	<Col span={24}>
																		<div style={{ marginBottom: 16 }}>
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

													</Space>
												</div>
											</Col>

								{/* 右栏 - 详细分析 */}
								<Col span={12}>
									<div style={{ height: '100%', overflowY: 'auto', paddingLeft: 8 }}>
										<Space direction="vertical" style={{ width: '100%' }} size="large">
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
																						<Text type="secondary">原句: &quot;{error.original_sentence}&quot;</Text>
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
																						<Text type="secondary">原句: &quot;{issue.original_sentence}&quot;</Text>
																	<Text type="secondary">{issue.suggestion}</Text>
																					</Space>
																				</List.Item>
																			)}
																		/>
																	</Card>
																)}

																{/* 发音分析 */}
																<Card 
																	title={
																		<Space>
																			<SoundOutlined style={{ color: '#722ed1' }} />
																			发音分析
																		</Space>
																	}
																	size="small"
																>
																	<Space direction="vertical" style={{ width: '100%' }}>
																		<div>
																			<Text strong>分析结果:</Text>
																			<div style={{ marginTop: 8 }}>
																				<Text>{result.pronunciation_analysis.analysis}</Text>
																			</div>
																		</div>
																		{result.pronunciation_analysis.potential_patterns.length > 0 && (
																			<div>
																				<Text strong>潜在发音模式:</Text>
																				<List
																					dataSource={result.pronunciation_analysis.potential_patterns}
																					renderItem={(pattern) => (
																						<List.Item>
																							<div>
																								<Text><Tag color="purple">{pattern.suspected_issue}</Tag></Text>
																								<div style={{ marginTop: 4, marginLeft: 8 }}>
																									<Text strong>证据: </Text>
																									<Space wrap>
																										{pattern.evidence.map((evidence, index) => (
																											<Text key={index} type="secondary" style={{ fontStyle: 'italic' }}>&quot;{evidence}&quot;</Text>
																										))}
																									</Space>
																								</div>
																							</div>
																						</List.Item>
																					)}
																				/>
																			</div>
																		)}
																	</Space>
																</Card>


										</Space>
									</div>
								</Col>
							</Row>
						)}
					</div>

					{/* 下方输入区域 - 使用Sender组件 */}
					<div style={{ marginTop: 'auto' }}>
						<Flex justify='center' gap='middle' vertical style={{ marginBottom: 16 }}>
							<Button
								icon={<ClearOutlined />}
								onClick={handleClear}
								size="small"
								style={{
									borderRadius: '8px'
								}}
							>
								清空
							</Button>
							{error && (
								<Alert
									message={error}
									type="error"
									showIcon
									closable
									onClose={() => setError('')}
									style={{ width: '100%' }}
								/>
							)}
						</Flex>
						<div
							className='px-5 py-2'
							style={{
								pointerEvents: isAnalyzing ? 'none' : 'auto',
							}}
						>
							<Sender
							onChange={setTextInput}
							onSubmit={handleSubmit}
							value={textInput}
							disabled={isAnalyzing}
							placeholder="请输入要进行雅思口语分析的英语文本内容..."
							loading={isAnalyzing}
							prefix={
								<Upload
									beforeUpload={handleFileUpload}
									showUploadList={false}
									accept=".md,.txt"
									disabled={isAnalyzing}
								>
									<Button
										type="text"
										shape="circle"
										icon={<UploadOutlined />}
										disabled={isAnalyzing}
										title="上传 Markdown 文件"
									/>
								</Upload>
							}
						/>
						</div>
					</div>
				</div>
			</Content>
		</Layout>
	);
};

export default IELTSPage;
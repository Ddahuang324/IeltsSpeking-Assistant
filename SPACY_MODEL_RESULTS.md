# SpaCy 模型返回结果详细说明

本文档详细说明了集成在 `english_analysis_service.py` 中的 SpaCy 模型的返回结果结构和各字段含义。

## API 接口

### 1. `/semantic` 接口

**请求方式**: POST  
**请求体**: 
```json
{
  "text": "要分析的英文文本"
}
```

**返回结果结构**:

```json
{
  "entities": [
    {
      "text": "实体文本",
      "label": "实体类型",
      "start": 起始位置,
      "end": 结束位置,
      "description": "实体类型描述"
    }
  ],
  "dependencies": [
    {
      "text": "词汇",
      "dep": "依存关系类型",
      "head": "支配词",
      "children": ["子词列表"]
    }
  ],
  "pos_tags": [
    {
      "text": "词汇",
      "pos": "词性标签",
      "tag": "详细标签",
      "description": "词性描述"
    }
  ],
  "noun_phrases": ["名词短语列表"],
  "sentiment": {
    "sentiment": "positive/negative/neutral",
    "score": 情感分数,
    "method": "分析方法"
  },
  "similarity": {
    "sentences": [
      {
        "text": "句子文本",
        "similarity_to_doc": 与整个文档的相似度
      }
    ],
    "average_similarity": 平均相似度
  },
  "tokens": [
    {
      "text": "词汇",
      "lemma": "词根",
      "pos": "词性",
      "tag": "详细标签",
      "dep": "依存关系",
      "shape": "词形",
      "is_alpha": 是否为字母,
      "is_stop": 是否为停用词,
      "is_punct": 是否为标点符号
    }
  ]
}
```

## 字段详细说明

### 1. entities (命名实体识别)

SpaCy 能够识别文本中的各种命名实体，包括：

- **PERSON**: 人名
- **ORG**: 组织机构名
- **GPE**: 地理政治实体（国家、城市等）
- **DATE**: 日期
- **TIME**: 时间
- **MONEY**: 货币金额
- **PERCENT**: 百分比
- **FACILITY**: 设施名称
- **PRODUCT**: 产品名称
- **EVENT**: 事件名称
- **WORK_OF_ART**: 艺术作品
- **LAW**: 法律文件
- **LANGUAGE**: 语言名称
- **NORP**: 国籍或宗教政治团体

每个实体包含：
- `text`: 实体在原文中的文本
- `label`: 实体类型标签
- `start`/`end`: 在原文中的字符位置
- `description`: 实体类型的中文描述

### 2. dependencies (依存句法分析)

依存句法分析显示词汇之间的语法关系：

- **nsubj**: 名词主语
- **dobj**: 直接宾语
- **amod**: 形容词修饰语
- **prep**: 介词
- **pobj**: 介词宾语
- **det**: 限定词
- **aux**: 助动词
- **advmod**: 副词修饰语
- **compound**: 复合词
- **conj**: 并列连词

每个依存关系包含：
- `text`: 当前词汇
- `dep`: 依存关系类型
- `head`: 支配这个词的词汇
- `children`: 被这个词支配的词汇列表

### 3. pos_tags (词性标注)

词性标注识别每个词汇的语法功能：

- **NOUN**: 名词
- **VERB**: 动词
- **ADJ**: 形容词
- **ADV**: 副词
- **PRON**: 代词
- **DET**: 限定词
- **ADP**: 介词
- **NUM**: 数词
- **CONJ**: 连词
- **PRT**: 小品词
- **PUNCT**: 标点符号
- **X**: 其他

### 4. noun_phrases (名词短语)

提取文本中的名词短语，这些通常是重要的概念或主题。

### 5. sentiment (情感分析)

基于词汇的简单情感分析：
- `sentiment`: 情感极性（positive/negative/neutral）
- `score`: 情感分数（-1到1之间）
- `method`: 分析方法（"lexicon-based"）

### 6. similarity (句子相似度)

计算文档中各句子与整个文档的语义相似度：
- `sentences`: 每个句子及其相似度分数
- `average_similarity`: 所有句子的平均相似度

### 7. tokens (详细词汇信息)

每个词汇的详细语言学信息：
- `text`: 原始文本
- `lemma`: 词根形式
- `pos`: 词性
- `tag`: 详细的词性标签
- `dep`: 依存关系
- `shape`: 词形模式（如 "Xxxxx" 表示首字母大写的5字母词）
- `is_alpha`: 是否全为字母
- `is_stop`: 是否为停用词
- `is_punct`: 是否为标点符号

## 使用示例

### 输入文本
```
"Apple Inc. was founded by Steve Jobs in Cupertino, California on April 1, 1976."
```

### 返回结果示例
```json
{
  "entities": [
    {
      "text": "Apple Inc.",
      "label": "ORG",
      "start": 0,
      "end": 10,
      "description": "组织机构"
    },
    {
      "text": "Steve Jobs",
      "label": "PERSON",
      "start": 26,
      "end": 36,
      "description": "人名"
    },
    {
      "text": "Cupertino",
      "label": "GPE",
      "start": 40,
      "end": 49,
      "description": "地理政治实体"
    },
    {
      "text": "California",
      "label": "GPE",
      "start": 51,
      "end": 61,
      "description": "地理政治实体"
    },
    {
      "text": "April 1, 1976",
      "label": "DATE",
      "start": 65,
      "end": 78,
      "description": "日期"
    }
  ],
  "noun_phrases": [
    "Apple Inc.",
    "Steve Jobs",
    "Cupertino",
    "California",
    "April"
  ],
  "sentiment": {
    "sentiment": "neutral",
    "score": 0.0,
    "method": "lexicon-based"
  }
}
```

## 注意事项

1. **模型依赖**: 使用 `en_core_web_sm` 模型，首次运行时会自动下载
2. **性能**: 对于长文本，处理时间可能较长
3. **准确性**: 实体识别和词性标注的准确性取决于文本的复杂性和领域
4. **语言**: 目前仅支持英文文本分析

## 扩展功能

### `/comprehensive` 接口

结合了原有的雅思分析功能和新的语义分析功能，返回更全面的分析结果，包括：
- 雅思写作评分（词汇、语法、时态、流利度等）
- 完整的语义分析结果
- 综合建议和改进意见

这个接口特别适合英语学习者进行综合性的文本分析和改进。
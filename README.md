# AI 小说工坊 (AI Novel Workshop)

一个功能强大的 AI 辅助小说创作 Web 应用，基于 React + TypeScript 构建，集成了多种 AI 大语言模型提供商，提供智能化的小说创作、分析和管理功能。

## ✨ 功能特性

### 🤖 AI 集成
- **12+ AI 提供商支持**：OpenAI、Anthropic、Google、DeepSeek、xAI、阿里通义、字节豆包、月之暗面、智谱 AI 等
- **200+ 模型可选**：GPT-4o、Claude 4、Gemini 2.5、DeepSeek V3、Grok 3 等
- **统一网关**：Vercel AI Gateway 支持，一个 API Key 访问所有模型
- **流式输出**：实时显示 AI 生成内容
- **Agent 模式**：智能任务规划与执行，支持复杂创作任务

### 📝 创作功能
- **智能创作助手**：基于上下文的智能续写、改写、扩写
- **角色管理**：角色档案、性格特征、关系图谱、成长弧线
- **世界观构建**：世界观设定、历史背景、势力分布
- **大纲管理**：章节大纲、情节节点、伏笔追踪
- **风格学习**：学习参考文本风格，模仿写作
- **叙事引擎**：一致性检查、伏笔追踪、时间线管理

### 🔧 技术特性
- **Web 应用**：无需安装，浏览器直接访问
- **本地存储**：数据存储在浏览器本地，保护隐私
- **加密存储**：API Key 和敏感数据 AES-256 加密
- **响应式设计**：支持桌面端和移动端

## 🚀 快速开始

### 前置要求
- Node.js 18+

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd novelAI
```

2. **安装依赖**
```bash
npm install
```

3. **启动开发服务器**
```bash
npm run dev
```

4. **访问应用**
打开浏览器访问 http://localhost:5173

## 📖 使用指南

### 配置 AI 提供商

1. 点击左上角 **菜单** 图标打开侧边栏
2. 点击 **设置** 图标
3. 在 **API 密钥** 区域添加你的 API Key
4. 选择平台并输入密钥
5. 返回聊天页面，点击 **选择模型** 选择要使用的模型

### 支持的 AI 提供商

| 提供商 | 名称 | 调用方式 | 模型数量 |
|--------|------|---------|---------|
| `gateway` | Vercel AI Gateway | 统一网关 | 200+ |
| `openai` | OpenAI | 直接 SDK | 40+ |
| `anthropic` | Anthropic | 直接 SDK | 10+ |
| `google` | Google | 直接 SDK | 15+ |
| `deepseek` | DeepSeek | 直接 SDK | 6+ |
| `xai` | xAI | 直接 SDK | 10+ |
| `alibaba` | 阿里巴巴 | 仅 Gateway | 15+ |
| `bytedance` | 字节跳动 | 仅 Gateway | 2+ |
| `moonshot` | 月之暗面 | 仅 Gateway | 5+ |
| `minimax` | MiniMax | 仅 Gateway | 4+ |
| `zhipu` | 智谱 AI | 仅 Gateway | 8+ |

### 创建项目

1. 点击 **文件** → **打开项目**
2. 选择或创建小说项目目录
3. 项目结构将自动创建：
```
my-novel/
├── world/           # 世界观设定
├── characters/      # 角色档案
├── outline/         # 大纲
├── chapters/        # 章节
└── notes/           # 笔记
```

### 开始创作

- **普通模式**：简单对话、快速续写、风格转换
- **Agent 模式**：复杂创作任务、多步骤操作、自动规划执行

## 🛠️ 开发命令

```bash
# 开发
npm run dev          # 启动开发服务器

# 构建
npm run build        # 构建生产版本

# 代码质量
npm run lint         # TypeScript 类型检查
npm run lint:eslint  # ESLint 检查
npm run lint:fix     # 自动修复 ESLint 问题
npm run format       # Prettier 格式化代码

# 测试
npm run test         # 运行测试（监听模式）
npm run test:run     # 运行测试（单次）
```

## 🏗️ 项目结构

```
src/
├── api/              # API 接口
├── components/       # React 组件
│   ├── chat/         # 聊天相关组件
│   ├── common/       # 通用组件
│   ├── editor/       # 编辑器组件
│   ├── layout/       # 布局组件
│   ├── panels/       # 面板组件
│   ├── settings/     # 设置组件
│   └── visualization/# 可视化组件
├── config/           # 配置文件
├── constants/        # 常量定义
├── hooks/            # React Hooks
├── lib/              # 工具库
├── services/         # 服务层
│   ├── ai/           # AI 相关服务
│   ├── analysis/     # 分析服务
│   ├── character/    # 角色服务
│   ├── core/         # 核心服务
│   ├── kernel/       # 内核服务
│   ├── knowledge/    # 知识服务
│   ├── narrative/    # 叙事服务
│   ├── plot/         # 情节服务
│   ├── style/        # 风格服务
│   ├── tools/        # 工具服务
│   └── writing/      # 写作服务
├── store/            # Zustand 状态管理
├── types/            # TypeScript 类型定义
└── utils/            # 工具函数
```

## 🔒 安全性

- **API Key 加密**：使用 AES-GCM 256 位加密存储
- **本地存储**：所有数据存储在本地，不上传云端
- **敏感数据保护**：对话内容、项目路径等敏感信息加密存储

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

MIT License

## 🙏 致谢

- [React](https://react.dev/) - UI 框架
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI 集成 SDK
- [Zustand](https://zustand-demo.pmnd.rs/) - 状态管理
- [TailwindCSS](https://tailwindcss.com/) - CSS 框架
- [Vite](https://vitejs.dev/) - 构建工具

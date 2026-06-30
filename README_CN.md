# ThreadMind

> 一个 AI 驱动的 Chrome 插件，将 ChatGPT 对话实时转化为结构化知识，支持知识收集、可编辑沉淀与 Markdown 导出。

<p align="center">

🇨🇳 <b>简体中文（当前）</b> | 🇺🇸 <a href="README.md">English</a>

</p>

---

## 项目简介

ThreadMind 是一个面向 AI 学习场景的 Chrome 插件，旨在帮助用户将 ChatGPT 对话从「聊天记录」转化为真正可沉淀、可管理、可复用的知识。

传统 AI 对话存在以下问题：

- 对话越来越长，难以快速定位重点
- 优质回答和代码片段容易淹没在聊天记录中
- 学习结束后还需要重新整理笔记
- 缺乏清晰的知识结构，难以回顾和复习

ThreadMind 在用户与 ChatGPT 对话的过程中，自动构建知识结构，并提供知识收集、编辑和导出能力，让学习与知识管理融为一个连续的流程。

---

# 核心功能

## 📚 实时知识目录

根据 ChatGPT 对话自动生成层级化知识结构。

支持：

- L1 / L2 / L3 多级知识目录
- 树状展开与折叠
- 实时同步当前讨论内容
- 帮助用户追踪整体思路

---

## 🤖 AI 知识 Block

每个具有知识价值的问题都会生成一个知识 Block。

每个 Block 包含：

- AI 自动生成摘要
- 用户收集的重要内容
- 用户自由编辑笔记

对于：

- 「换个方式解释」
- 「举个例子」
- 「再详细一点」

等澄清性问题，不会重复生成新的 Block，保持目录简洁。

---

## ✨ 内容收集（Collect）

用户可以直接在 ChatGPT 页面：

1. 选中文字或代码
2. 点击 **+ Collect**
3. 自动保存到当前知识 Block

支持：

- 普通文本
- 代码片段

收集后的内容会：

- 在 ChatGPT 页面保持高亮
- 自动加入知识沉淀区域

---

## 📝 Pre 沉淀

展开知识 Block 后进入可编辑沉淀区。

用户可以：

- 修改 AI 自动摘要
- 添加个人理解
- 整理学习笔记
- 删除不需要的内容
- 编辑代码示例

所有修改都会自动保存到本地。

---

## 📤 Markdown 导出

支持一键导出结构化 Markdown。

导出内容包括：

- 多级标题
- AI 摘要
- 收集内容
- 用户编辑内容
- 代码块

兼容：

- Obsidian
- Notion
- Typora
- VS Code
- 其他 Markdown 编辑器

---

# 产品流程

```text
ChatGPT 对话
        │
        ▼
监听用户与 AI 消息
        │
        ▼
Claude 分析知识结构
        │
        ▼
生成知识目录
        │
        ▼
用户收集重点内容
        │
        ▼
编辑知识沉淀
        │
        ▼
Markdown 导出
```

---

# 系统架构

```text
ChatGPT
     │
     ▼
Content Script
     │
     ├── Conversation Observer
     ├── Content Collector
     └── Sidebar Injection
             │
             ▼
React Sidebar
     │
     ├── Block Tree
     ├── Note Editor
     ├── Markdown Export
     └── Chrome Storage
             │
             ▼
Background Service Worker
             │
             ▼
Claude API
```

---

# 技术栈

### 前端

- React 18
- TypeScript
- Vite
- CSS Modules

### Chrome Extension

- Manifest V3
- Content Script
- Background Service Worker
- Chrome Storage API

### AI

- Anthropic Claude API

### 第三方库

- dnd-kit
- Tabler Icons

---

# 项目结构

```text
src
├── background
├── content
├── shared
├── sidebar
│   ├── components
│   └── hooks
└── types

public
scripts
```

---

# 已完成功能

### Module 1：插件基础架构

- Chrome 插件初始化
- Sidebar 注入
- 页面布局调整

### Module 2：对话监听

- ChatGPT 消息监听
- User / Assistant 消息配对
- Streaming 状态检测

### Module 3：知识结构生成

- AI 判断是否生成知识 Block
- 自动生成层级目录
- 树状结构渲染

### Module 4：知识沉淀

- Block 展开
- AI 摘要
- 内容收集
- 可编辑笔记
- 本地持久化

### Module 5：Markdown 导出

- 层级标题
- Markdown 转换
- Obsidian 兼容

---

# API Key

ThreadMind 使用 Anthropic Claude API。

API Key：

- 由用户自行提供
- 保存在 `chrome.storage.local`
- 不上传 GitHub
- 不存储到任何服务器

---

# 安装方式

克隆项目：

```bash
git clone https://github.com/yunfeili1001-hue/ThreadMind.git
```

安装依赖：

```bash
npm install
```

启动开发：

```bash
npm run dev
```

Chrome 打开：

```
chrome://extensions
```

开启开发者模式，点击：

```
Load unpacked
```

选择生成的 `dist` 文件夹即可。

---

# 开发计划（Roadmap）

## 当前 MVP

- ✅ Sidebar 注入
- ✅ ChatGPT 对话监听
- ✅ AI Block 生成
- ✅ 多级知识目录
- ✅ 内容收集
- ✅ 可编辑知识沉淀
- ✅ Markdown 导出
- ✅ API Key 配置

## 后续规划

- ⏳ AI Learning Agent
- ⏳ 知识图谱
- ⏳ Flashcard 自动生成
- ⏳ Quiz 自动生成
- ⏳ 云同步
- ⏳ 多模型支持
- ⏳ 图片内容收集
- ⏳ Notion API 集成

---

# 产品设计理念

ThreadMind 遵循三个核心原则：

### Structure Before Storage

先建立知识结构，再进行知识沉淀。

### Collect While Learning

学习过程中即时收集，而不是学习结束后再整理。

### Human in the Loop

AI 负责组织信息，人始终掌握知识编辑与管理的最终控制权。

---

# License

MIT License

---

**Developed by Hana Li**

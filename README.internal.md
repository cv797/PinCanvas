# XXL Canvas Studio（内部版）

基于节点的 AI 创作画布，支持图片生成、视频生成、角色设计、分镜板等多种 AI 创作工作流。

## 🏢 内部信息

- **项目负责人**: [填写负责人]
- **内部文档**: [内部 Wiki 链接]
- **测试环境**: [测试环境地址]
- **生产环境**: [生产环境地址]
- **监控面板**: [监控系统链接]

## ✨ 特性

- 🎨 **节点式编辑器** - 基于 xyflow 的可视化工作流编辑
- 🤖 **多模型支持** - OpenAI、Midjourney 等主流 AI 模型
- 🎬 **丰富的节点类型** - 19 种节点覆盖图片、视频、角色、场景等创作场景
- 💾 **自动保存** - IndexedDB 本地持久化，支持撤销/重做
- 🔧 **类型安全** - TypeScript + React 18 + Zustand 状态管理
- 🧪 **完整测试** - 41 个测试用例，MSW 模拟 API

## 🚀 快速开始

### 前置要求

- [Bun](https://bun.sh/) >= 1.0
- Node.js >= 18（可选，Bun 可替代）

### 安装与运行

```bash
# 安装依赖
bun install

# 启动前端开发服务器
bun run dev        # http://127.0.0.1:5173

# 启动后端服务（可选，用于对象存储功能）
bun run dev:server # http://127.0.0.1:8787
```

## ⚙️ 配置

### 对象存储配置（可选）

如需使用媒体上传功能，需配置对象存储服务。支持两种配置方式：

**方式 1：配置文件（推荐）**

```bash
# 1. 复制配置模板
cp server/config.example.json server/config.local.json

# 2. 编辑 server/config.local.json，填入真实凭证
# 该文件已在 .gitignore 中，不会被提交
```

**方式 2：环境变量**

```bash
cp .env.example .env
# 编辑 .env 文件
```

**内部开发者注意**：
- 测试环境凭证请从内部密钥管理系统获取
- 生产环境配置请联系运维团队
- 配置文件路径：[内部配置文档链接]

## 🛠️ 开发命令

```bash
bun run dev        # 启动前端开发服务器
bun run dev:server # 启动后端服务
bun run build      # 构建生产版本
bun run preview    # 预览生产构建
bun run typecheck  # TypeScript 类型检查
bun run test       # 运行测试
bun run lint       # 代码检查
bun run format     # 代码格式化
```

## 📦 技术栈

- **前端框架**: React 18 + TypeScript
- **状态管理**: Zustand + Zundo（撤销/重做）
- **节点编辑器**: @xyflow/react
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **本地存储**: idb-keyval (IndexedDB)
- **构建工具**: Vite
- **运行时**: Bun
- **测试**: Vitest + MSW

## 📋 开发路线图

查看 [`docs/roadmap.md`](./docs/roadmap.md) 了解详细的开发计划和功能规划。

### 已完成功能

- ✅ 核心画布系统（节点编辑、连线、撤销/重做）
- ✅ 19 种节点类型（图片生成、视频生成、角色设计等）
- ✅ OpenAI 兼容 API + Midjourney 集成
- ✅ 自动保存与历史记录
- ✅ 角色/场景库管理
- ✅ 分镜板功能

### 计划中功能

- 🔄 多用户协同编辑
- 🔄 云端存储同步
- 🔄 暗色主题
- 🔄 更多 AI 模型支持

## 📁 项目结构

```
.
├── docs/                   # 设计文档与 API 契约
├── server/                 # Bun 后端服务
│   ├── config.ts           # 配置加载逻辑
│   ├── config.example.json # 配置模板
│   └── index.ts            # 服务入口
├── src/
│   ├── canvas/             # 节点与连线组件
│   ├── components/         # 通用 UI 组件
│   ├── store/              # Zustand 状态管理
│   ├── api/                # API 客户端
│   ├── types/              # TypeScript 类型定义
│   ├── hooks/              # React Hooks
│   └── utils/              # 工具函数
└── tools/                  # 开发工具脚本
```

## 🔒 安全提示

⚠️ **请勿在代码中硬编码 API 密钥或云服务凭证**

- 所有敏感配置应通过 `server/config.local.json` 或 `.env` 文件管理
- 这些文件已在 `.gitignore` 中排除，不会被提交到版本控制
- 分享项目链接时，注意不要在 URL 中暴露 API Key
- 如果不慎提交了敏感信息，请立即撤销相关密钥并清理 git 历史

## 🚀 部署

### 测试环境部署

```bash
# [添加测试环境部署命令]
```

### 生产环境部署

```bash
# [添加生产环境部署命令]
```

详细部署文档请参考：[内部部署文档链接]

## 🤝 贡献

内部开发者请参考 [内部开发规范](内部链接)。

### 代码审查流程

1. 创建功能分支
2. 提交 MR/PR
3. 至少一位 reviewer 审核
4. CI 通过后合并

## 📞 联系方式

- **技术支持**: [内部技术支持渠道]
- **问题反馈**: [内部 Issue 系统]
- **紧急联系**: [On-call 联系方式]

## 📄 许可证

本项目采用 [MIT License](./LICENSE) 开源。

## 🙏 致谢

本项目是对原有单文件 HTML 应用的 clean-room 重写，未使用任何原始代码。

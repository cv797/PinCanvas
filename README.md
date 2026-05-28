# XXL Canvas

节点式 AI 创作画布工程（clean-room rewrite）。

## 历史背景

本仓库基于一份 Vite 打包的单文件 HTML（已移至 `_legacy/`）做行为反推，未拷贝任何原始代码。
- 反推产物：`docs/`（架构、API 契约、节点 schema、持久化、模型路由、关键代码摘录）
- 重写产物：`src/`（TypeScript + React 18 + xyflow + Zustand）

## 开发

```bash
bun install
bun run dev        # http://127.0.0.1:5173
bun run build
bun run typecheck
```

## 里程碑

- [x] M0 逆向设计文档
- [x] M1 工程骨架
- [x] M2 节点 + 连线 + 持久化（4 种 kind / IDB 自动保存 / 撤销重做）
- [x] M3 API 适配层（OpenAI 兼容 + Midjourney + msw e2e 测试）
- [x] M4 GenImage 节点 + 引用图链路（MVP 闭环）
- [x] M5.1 – M5.11 11 项增量：设置面板 / 蒙版 / video / video-analyze / MJ / 角色场景 / extract / storyboard / 历史面板 / 角色场景视频 / 自定义模型库
- [x] 布局重构（Header + 左侧垂直 Toolbar）
- [ ] 剩余缺口：novel-input / character-description / scene-description / image-compare / local-save / 导出 ZIP / MJ U-V / 本地缓存服务 / 暗色主题

**下一步选项？** → 见 [`docs/roadmap.md`](./docs/roadmap.md) §1.1（"还没做的"），列了对比 V3.8.8 后的剩余缺口与优先级。

## 目录结构

```
.
├── _legacy/                # 原 HTML（参考用，不参与构建）
├── docs/                   # 反推设计文档
├── src/
│   ├── canvas/             # 节点 / 连线 React 组件
│   ├── components/         # 通用 UI
│   ├── store/              # Zustand 状态
│   ├── api/                # OpenAI 兼容客户端
│   ├── types/              # TS 类型
│   ├── hooks/
│   └── utils/
└── tools/                  # 一次性反推脚本
```

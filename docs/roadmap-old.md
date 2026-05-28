# Roadmap & Execution Plan

> 给"换终端 / 冷启动"的 Claude 看的执行手册。每个里程碑都列了：**改哪些文件、关键 API 签名、验收命令**。\
> 顺序：M2 → M3 → M4 → M5+。前一个里程碑没通过验收，不要进下一个。

***

## 0. 如何在新会话续上

新会话起手就跑这串，建立上下文：

```bash
cd ~/xxl/node-canvas-studio
git log --oneline -5                       # 确认在哪个 commit
ls docs/                                   # 看有哪些设计文档
bun install                                # 装依赖（已 lock）
bun run typecheck                          # 验证现状不破
bun run dev                                # 启动 dev server
```

然后必读 3 份 docs（其余按需）：

* `docs/architecture.md` — 数据模型 + 上游反查 + 调度

* `docs/node-types.md` — 判别联合 schema

* 本文件 — 当前在哪、下一步干啥

**告诉 Claude**：当前 M0-M5.11 都已完成，新工作从 §1.1 "V3.8.8 功能缺口审计"里挑。告诉 Claude `做 novel-input + 抽取链路`、`做导出 ZIP`、`做 local-save` 等具体项，它会按你之前的实施风格继续。

***

## 1. 当前状态（截至 2026-05-13 审计）

* ✅ **M0** 反推设计文档完成（6 份，1300+ 行）
* ✅ **M1** 工程骨架跑通（Vite + React 18 + TS + xyflow + Zustand）
* ✅ **M2** 画布 + 数据层（commit `d175491`）
* ✅ **M3** API 适配层 + vitest/msw（commit `dfc8b5b`，41 测试覆盖）
* ✅ **M4** GenImage + 引用图链路 — MVP 闭环（commit `990917e`）
* ✅ **M5.1 – M5.11** 11 项增量已完成，见第 6 节
* ✅ **布局重构** Header + 左侧垂直 Toolbar，对齐 V3.8.8 参考图（commit `ba9fd61`）
* ✅ **当前已注册节点**：`input-image` / `text-node` / `video-input` / `gen-image` / `gen-video` / `video-analyze` / `extract-characters-scenes` / `storyboard-node` / `create-character` / `create-scene` / `generate-character-image` / `generate-scene-image` / `generate-character-video` / `generate-scene-video` / `preview`

**测试**：vitest 41/41 · typecheck 干净 · production build 440KB / gzip 133KB。

> 注：本节基于 `_legacy/Tapnow.Studio-V3.8.8-rc7.html` 中的节点类型 / API 路径 / MJ 操作文案，与当前 `src/types/node.ts`、`src/components/AddNodeMenu.tsx`、`src/api/*`、`src/hooks/useGenerationTrigger.ts` 交叉比对。当前工作区有未提交 UI 改动，本审计只按文件现状判断。

### 1.1 V3.8.8 功能缺口审计

按用户价值和依赖关系排序：

| 优先级 | 项 | 备注 |
|---|---|---|
| P0 | **长文本小说入口闭环** | legacy 有 `novel-input`；当前只有 `text-node` + `extract-characters-scenes.sourceText`，缺大文本编辑、从小说节点直连抽取、抽取结果回填角色/场景库的完整 UX |
| P0 | **导出 ZIP / 批量下载** | legacy 出现 `application/zip`、`batch-download`、`storyboard-download`；当前只在历史面板展示产物，没有项目资产打包、分镜批量导出、命名规则和下载队列 |
| P0 | **本地保存服务链路** | legacy 有 `local-save` 和 `/ping` `/save-cache` `/save-batch` `/pick-path` `/list-files` `/config`；当前没有 local-save 节点、服务健康检查、路径选择、批量保存、失败重试 |
| P1 | **描述模板节点** | legacy 有 `character-description` / `scene-description` / `desc-model`；当前 `create-character` / `create-scene` 只存 name/description/prompt，缺模板化描述生成、模型配置和一键入库 |
| P1 | **图片对比 / 合成节点** | legacy 有 `image-compare` 与 `/v1/images/compositions`；当前无节点、无 API adapter、无两图输入解析和结果预览 |
| P1 | **Midjourney 二次操作** | legacy 有 U1-U4 / V1-V4 文案和 `/mj/submit/upload-discord-images`；当前只实现 imagine + fetch + 4 宫格本地切图，缺 upscale / variation / reroll / 上传图生图 |
| P1 | **模型配置节点化** | legacy 有 `role-image-model` / `role-video-model` / `shot-model` / `extract-model` / `analyze-model`；当前模型配置散落在具体节点下拉和 Settings，缺可复用配置节点与下游继承规则 |
| P2 | **Storyboard 高级产物** | legacy 有 `storyboard-as-video` / `storyboard-download`；当前 storyboard 只支持 shot 手动增删、单 shot 生图/视频，缺整板批量生成、合并视频/序列、导出分镜包 |
| P2 | **远端角色接口兼容** | legacy 出现 `/v1/characters`；当前角色/场景库仅 IDB 本地持久化。是否需要远端同步需按实际 API 可用性确认 |
| P3 | **暗色主题** | legacy 包含大量 dark 样式；当前用户上次明确"保留浅色"，先不做 |
| skip | **国际化 / 数据迁移** | 用户明确排除（原列在 roadmap M5.9 / M5.10） |

#### 当前不缺 / 已覆盖

- 基础画布：节点创建、拖拽、连线、删除、撤销重做、自动保存已覆盖。
- 核心生成：OpenAI 兼容图片、图片编辑、异步任务、视频生成、chat、多模型路由已覆盖。
- 上游解析：图片 / 视频帧 / 文本 / 已生成节点输出作为下游输入已覆盖基础版本。
- 角色场景基础：本地角色/场景库、角色/场景图片、角色/场景视频、文本抽取角色/场景已覆盖基础版本。

### 1.2 建议后续里程碑

#### 短期里程碑 (V3.8.8 功能补齐)

| 里程碑 | 范围 | 主要文件 | 验收 |
|---|---|---|---|
| **M5.12 novel-input 闭环** | 新增 `novel-input` 节点；`extract-characters-scenes` 支持优先读上游小说全文；抽取结果支持一键写入角色/场景库 | `src/types/node.ts`、`src/canvas/factory.ts`、`src/components/AddNodeMenu.tsx`、`src/canvas/nodes/NovelInputNode.tsx`、`src/hooks/useUpstream.ts`、`src/canvas/nodes/ExtractCharactersScenesNode.tsx` | 大段文本节点连到抽取节点，触发后能生成角色/场景列表并入库 |
| **M5.13 导出 ZIP / 批量下载** | 收集画布产物、历史产物、storyboard shots；生成 ZIP；支持命名规则和失败列表 | `src/utils/export.ts`、`src/components/Header.tsx`、`src/components/HistoryDrawer.tsx`、`src/canvas/nodes/StoryboardNode.tsx` | 一键下载含图片/视频 URL 清单、dataURL 文件、project.json 的 zip |
| **M5.14 local-save 服务** | 新增 `local-save` 节点和本地服务 client；支持 ping、选路径、单个/批量保存、配置读取 | `src/api/local-cache.ts`、`src/types/node.ts`、`src/canvas/nodes/LocalSaveNode.tsx`、`src/hooks/useGenerationTrigger.ts` | local service 可用时保存成功；不可用时节点显示明确错误且不影响画布 |
| **M5.15 描述模板节点** | 新增 `character-description` / `scene-description`；通过 chat 模型从小说/文本生成描述 prompt；写回库 | `src/types/node.ts`、`src/canvas/nodes/CharacterDescriptionNode.tsx`、`src/canvas/nodes/SceneDescriptionNode.tsx`、`src/hooks/useGenerationTrigger.ts` | 连接 novel/text 后能生成结构化描述并创建/更新角色或场景 |
| **M5.16 image-compare / compositions** | 新增双图输入节点；封装 `/v1/images/compositions`；支持 A/B 预览和合成结果输出 | `src/api/images.ts`、`src/types/node.ts`、`src/hooks/useUpstream.ts`、`src/canvas/nodes/ImageCompareNode.tsx` | 两个图片上游连入后可触发合成，输出可继续作为下游 reference |
| **M5.17 Midjourney actions** | 封装 U1-U4 / V1-V4 / reroll；支持 MJ 图生图上传；历史记录保存动作来源 | `src/api/midjourney.ts`、`src/canvas/nodes/GenImageNode.tsx`、`src/store/history.ts` | MJ 生成后可对任一格执行 upscale / variation，并把结果写回节点 |
| **M5.18 配置节点化** | 新增 role image/video、shot、extract、analyze 配置节点；下游优先继承上游配置，节点本地设置可覆盖 | `src/types/node.ts`、`src/hooks/useUpstream.ts`、`src/canvas/factory.ts`、相关 node components | 一个配置节点连多个生成节点时，模型/比例/时长等设置一致生效 |

#### 中长期里程碑 (多用户协同平台)

> 详见 `docs/feasibility-report.md`，以下为概要。

| 里程碑 | 范围 | 工期 | 优先级 |
|---|---|---|---|
| **M6.0 架构准备** | 后端重写为 Go (Gin 框架)；Repository 模式；项目元数据扩展；前端路由改造 | 3 周 | P0 |
| **M6.1 用户中心** | 注册/登录；JWT 认证；个人资料管理；第三方登录 | 2 周 | P0 |
| **M6.2 存储中心** | 媒体上传到 OSS；CDN 加速；存储配额管理；资源引用计数 | 2 周 | P0 |
| **M6.3 项目管理** | 多项目列表；项目 CRUD；版本历史；项目分享；跨设备同步 | 4 周 | P0 |
| **M6.4 协同办公** | WebSocket 实时同步；Yjs 冲突解决；权限控制；在线用户列表 | 6 周 | P1 |
| **M6.5 共同参片** | 团队素材库；素材评论；标签分类；使用统计 | 3 周 | P1 |

**总工期**: 约 6 个月 (含缓冲时间)

***

## 2. 全局约束（重写时必须遵守）

| 约束                                                                                                | 出处                                     |
| ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `referenceImages` 上限 5 张，满 5 替换第 1 张                                                              | `docs/reverse-engineering-notes.md` §2 |
| 撤销栈用 zundo + immer，不要手写 deep-clone                                                                | §4                                     |
| 自动保存用 store.subscribe + debounce 1.5s，不要 setInterval                                              | §5                                     |
| 路由判定走 ModelDef 字段（`async` / `supportsEdit` / `provider`），**禁止** 在业务代码里 `model.includes('banana')` | `docs/model-routing.md` §3             |
| `tapnow_*` localStorage 键名**全部保留**，便于旧用户迁移                                                        | `docs/persistence.md` §1               |
| 节点 ID 形如 `node_${nanoid(10)}`；clone 必须生成新 ID                                                      | §3.4                                   |
| `{{var:format}}` 模板含任意 `:blob` 则整请求改 multipart                                                    | `docs/api-contract.md` §7              |
| Sora prompt 中 `@name` → `@{name}`（lookahead 防重复）                                                  | reverse-engineering-notes.md §8        |
| 测试覆盖 model-routing.md §3 列的全部用例                                                                   | `docs/model-routing.md` §3             |

***

## 3. M2 — 画布 + 数据层（2-4 h）

> ✅ **已完成**（commit `d175491`）。下面是当时的施工计划，保留供历史 / 反查参考。

**目标**：能创建 / 拖动 / 删除 4 种节点、画连线、刷新页面恢复、撤销重做。

### M2.1 类型定义（30 min）

新文件：

```text
src/types/node.ts           ← 见 docs/node-types.md §2，先实现 4 种 kind
src/types/edge.ts
src/types/project.ts
```

最小实现：

```ts
// src/types/node.ts
export type NodeKind = 'input-image' | 'preview' | 'text-node' | 'gen-image';
export type NodeId = string & { __brand: 'NodeId' };

export interface NodeBase {
  id: NodeId;
  kind: NodeKind;
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string | null;
}

export interface InputImageNode extends NodeBase {
  kind: 'input-image';
  settings: { content: string; filename?: string; width?: number; height?: number };
}

export interface PreviewNode extends NodeBase {
  kind: 'preview';
  settings: { previewType?: 'image' | 'video'; content?: string };
}

export interface TextNodeNode extends NodeBase {
  kind: 'text-node';
  settings: { text: string };
}

// M2 只放桩，M4 再补完整
export interface GenImageNode extends NodeBase {
  kind: 'gen-image';
  settings: {
    prompt: string;
    model: string;
    ratio?: string;
    resolution?: string;
    referenceImages?: string[];
    isGenerating?: boolean;
    progress?: number;
    error?: string | null;
  };
}

export type AppNode = InputImageNode | PreviewNode | TextNodeNode | GenImageNode;
```

```ts
// src/types/edge.ts
export interface AppEdge {
  id: string;
  from: NodeId;
  to: NodeId;
}
```

```ts
// src/types/project.ts
export interface ProjectSnapshot {
  version: 1;
  savedAt: number;
  projectName: string;
  nodes: AppNode[];
  edges: AppEdge[];
}
```

### M2.2 Zustand store + zundo（30 min）

新文件：`src/store/canvas.ts`

```ts
import { create } from 'zustand';
import { temporal } from 'zundo';
import { immer } from 'zustand/middleware/immer';
import type { AppNode, AppEdge, NodeId } from '@/types/node';

interface CanvasState {
  nodes: AppNode[];
  edges: AppEdge[];
  // 运行态，不进撤销栈
  selectedIds: NodeId[];

  addNode: (n: AppNode) => void;
  updateNode: <K extends AppNode['kind']>(
    id: NodeId,
    patch: Partial<Extract<AppNode, { kind: K }>>,
  ) => void;
  removeNode: (id: NodeId) => void;
  addEdge: (e: AppEdge) => void;
  removeEdge: (id: string) => void;
  setSelection: (ids: NodeId[]) => void;
  clear: () => void;
  hydrate: (snapshot: { nodes: AppNode[]; edges: AppEdge[] }) => void;
}

export const useCanvas = create<CanvasState>()(
  temporal(
    immer((set) => ({
      nodes: [],
      edges: [],
      selectedIds: [],
      addNode: (n) => set((s) => { s.nodes.push(n); }),
      updateNode: (id, patch) =>
        set((s) => {
          const i = s.nodes.findIndex((n) => n.id === id);
          if (i >= 0) Object.assign(s.nodes[i].settings, patch);
        }),
      removeNode: (id) =>
        set((s) => {
          s.nodes = s.nodes.filter((n) => n.id !== id);
          s.edges = s.edges.filter((e) => e.from !== id && e.to !== id);
        }),
      addEdge: (e) => set((s) => { s.edges.push(e); }),
      removeEdge: (id) => set((s) => { s.edges = s.edges.filter((e) => e.id !== id); }),
      setSelection: (ids) => set((s) => { s.selectedIds = ids; }),
      clear: () => set((s) => { s.nodes = []; s.edges = []; s.selectedIds = []; }),
      hydrate: (snap) =>
        set((s) => { s.nodes = snap.nodes; s.edges = snap.edges; s.selectedIds = []; }),
    })),
    {
      limit: 256,
      // 不把 selectedIds 进栈
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }) as Partial<CanvasState>,
      // hydrate 时清栈
      equality: (a, b) => a.nodes === b.nodes && a.edges === b.edges,
    },
  ),
);

export const useTemporal = useCanvas.temporal;
```

### M2.3 持久化层（45 min）

新文件：

```text
src/store/persistence.ts
src/store/prefs.ts
src/utils/debounce.ts
src/utils/id.ts
```

`prefs.ts` — 偏好键封装：

```ts
const PREFIX = 'tapnow_';
export function getPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch { return fallback; }
}
export function setPref<T>(key: string, value: T): void {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {}
}
```

`persistence.ts`：

```ts
import { createStore, get, set } from 'idb-keyval';
import type { ProjectSnapshot } from '@/types/project';

const snapshotStore = createStore('tapnow-autosave', 'snapshots');
const KEY = 'current';

export async function loadSnapshot(): Promise<ProjectSnapshot | null> {
  return (await get<ProjectSnapshot>(KEY, snapshotStore)) ?? null;
}
export async function saveSnapshot(s: ProjectSnapshot): Promise<void> {
  await set(KEY, s, snapshotStore);
  setPref('autosave_meta', { timestamp: s.savedAt, storage: 'idb' });
}
```

`utils/id.ts`：

```ts
import type { NodeId } from '@/types/node';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function nodeId(): NodeId {
  let s = 'node_';
  for (let i = 0; i < 10; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s as NodeId;
}
export function edgeId(): string { return 'edge_' + Math.random().toString(36).slice(2, 12); }
```

接入自动保存（在 App 顶层 useEffect 里）：

```ts
useEffect(() => {
  let timer: number | null = null;
  const unsub = useCanvas.subscribe((state) => {
    if (timer != null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      saveSnapshot({
        version: 1,
        savedAt: Date.now(),
        projectName: getPref('project_name', 'untitled'),
        nodes: state.nodes,
        edges: state.edges,
      });
    }, 1500);
  });
  return () => { unsub(); if (timer != null) window.clearTimeout(timer); };
}, []);
```

启动时 hydrate：

```ts
useEffect(() => {
  loadSnapshot().then((snap) => {
    if (snap) useCanvas.getState().hydrate({ nodes: snap.nodes, edges: snap.edges });
  });
}, []);
```

### M2.4 节点组件 + canvas（60 min）

新文件：

```text
src/canvas/Canvas.tsx
src/canvas/nodes/InputImageNode.tsx
src/canvas/nodes/PreviewNode.tsx
src/canvas/nodes/TextNode.tsx
src/canvas/nodes/GenImageNode.tsx     # M2 只放占位，M4 再补
src/components/Toolbar.tsx
```

`Canvas.tsx` 关键点：

* 用 `<ReactFlow>` 包装，`nodeTypes` 注册上面 4 个

* 把 `useCanvas` 的 nodes/edges 转换成 xyflow 形状（xyflow 的 Node 有自己的 type/position/data）

* `onNodesChange` / `onEdgesChange` / `onConnect` 回写到 store

* `onConnect` 时生成 `AppEdge` 并 addEdge

注意：xyflow 的 Node 和我们 AppNode 字段名不一致，需要适配层。建议：

```ts
function toFlowNode(n: AppNode): RFNode {
  return { id: n.id, type: n.kind, position: { x: n.x, y: n.y }, data: n };
}
function toFlowEdge(e: AppEdge): RFEdge {
  return { id: e.id, source: e.from, target: e.to };
}
```

`Toolbar.tsx` —— 顶部 4 个按钮：

* * 图片输入

* * 文本

* * 预览

* * 图片生成（占位）

### M2.5 操作 + 验收（30 min）

* 键盘：`Delete` 删选中节点 / 边；`Ctrl/Cmd + Z` / `Shift + Cmd + Z` 调 `useTemporal.getState().undo() / redo()`

* 拖图 / 粘贴 → 转 dataURL → 创建 InputImageNode

* 双击节点进入编辑模式（文本节点改 text、图片节点换图）

**验收清单**（人工跑一遍，全过才能进 M3）：

* [ ] Toolbar 4 按钮各能创建一个节点
* [ ] 节点可拖动；拖动结束位置进 store
* [ ] 节点间能连线，连线显示出来
* [ ] 选中节点按 Delete 能删；连接也跟着清
* [ ] Cmd+Z 撤销创建 / 删除 / 移动；Shift+Cmd+Z 重做
* [ ] 刷新页面，节点和连线恢复
* [ ] 文本节点能改文字，改完 1.5s 后刷新还在
* [ ] InputImage 节点能粘贴 / 拖拽图片（dataURL 或 URL）
* [ ] `bun run typecheck` 通过
* [ ] DevTools → Application → IndexedDB 能看到 `tapnow-autosave/snapshots/current`

***

## 4. M3 — API 适配层（1-2 h）

> ✅ **已完成**（commit `dfc8b5b`，23 测试通过含 msw e2e）。下方为原施工计划。

**目标**：能向 OpenAI 兼容 endpoint 发请求，但不接 UI。先写代码 + 单元测试，再在 M4 里被节点调用。

### M3.1 client + template engine（45 min）

新文件：

```text
src/api/client.ts            # fetch 封装 (超时 / 重试 / Abort / 错误归一)
src/api/template.ts          # {{var:format}} 解析 + JSON/FormData 路由
src/api/errors.ts            # ApiError / TemplateMissingError
src/api/__tests__/template.test.ts   # 模板单测（用 vitest）
```

`template.ts` 必须覆盖：

* 简单变量替换

* `:number` → parseInt

* `:blob` → 触发 multipart

* 缺变量 → 抛 TemplateMissingError

* 嵌套对象里的模板也要递归处理

### M3.2 model library + routing（30 min）

新文件：

```text
src/types/model.ts           # ModelDef
src/api/models.ts            # DEFAULT_MODELS（见 docs/model-routing.md §2）
src/api/model-routing.ts     # routeRequest()
src/api/__tests__/model-routing.test.ts
```

测试覆盖 `docs/model-routing.md §3` 列的全部 9 个用例。

### M3.3 endpoint 实现（30 min）

新文件：

```text
src/api/images.ts            # generations / edits（含 async 轮询）
src/api/videos.ts            # videos/generations
src/api/chat.ts              # chat/completions
src/api/poll.ts              # 通用轮询器（指数退避，maxDuration 5min）
```

**验收**：

* [ ] `bun run typecheck` 通过
* [ ] `bunx vitest run` 全部测试通过（M3 引入 vitest）
* [ ] 至少有一个 e2e-like 测试用 `msw` 模拟 OpenAI，验证 generations 调用成功

***

## 5. M4 — GenImage 节点 + 引用图链路（2-3 h）

> ✅ **已完成**（commit `990917e`，MVP 闭环）。下方为原施工计划。

**目标**：MVP 场景跑通。在画布上：

1. 放一个 InputImage 节点（拖入一张图）

2. 放一个 GenImage 节点

3. 连线

4. GenImage 节点里写 prompt、选 `nano-banana` 模型

5. 点生成 → 自动调 `/v1/images/edits` → 出图

6. 再放一个 GenImage 节点，连到上一步的 GenImage

7. 同样点生成 → 自动以上一张图为 referenceImage

### M4.1 useUpstream hook（30 min）

新文件：`src/hooks/useUpstream.ts`

按 `docs/architecture.md §6` 的伪代码实现，返回 `{ referenceImages, prompt, mask }`。

### M4.2 任务队列（45 min）

新文件：`src/store/tasks.ts`

* `enqueue(task)` / `dispatch()` 调度器

* 受 `tapnow_batch_queue_mode` + `tapnow_batch_concurrency` 控制

* 异步任务进 `polling` 状态，调用 `api/poll.ts`

### M4.3 GenImageNode 完整组件（60 min）

* prompt textarea

* 模型选择下拉（取自 `DEFAULT_MODELS` filter modality=image）

* ratio / resolution 下拉（取自 modelDef）

* 参考图缩略图栅格（来自 useUpstream，也支持手动拖入）

* 生成按钮 → 触发 `useGenerationTrigger`

* progress / error 状态展示

### M4.4 useGenerationTrigger hook（30 min）

`src/hooks/useGenerationTrigger.ts`：

```ts
async function trigger(nodeId: NodeId) {
  const node = ...; // 从 store 拿
  const upstream = resolveUpstream(nodeId);
  const model = getModelDef(node.settings.model);
  const route = routeRequest({ type: 'image' }, model, {
    hasReferenceImages: upstream.referenceImages.length > 0,
    hasMask: !!upstream.mask,
    useJimengLocalFile: getPref('jimeng_use_local_file', false),
  });
  // 入队
  enqueueTask({ nodeId, route, payload: { ...node.settings, ...upstream } });
}
```

**验收**：

* [ ] 上述 7 步在 dev server 里手工跑通
* [ ] 连线两个 GenImage 节点，第二个能自动拿到第一个的输出做 referenceImage
* [ ] 5 张参考图上限生效；第 6 张替换第 1 张
* [ ] 错误情况（无 API key / 网络错误）显示在节点上不崩溃
* [ ] 任务队列受 concurrency 控制（手动调成 1 + parallel 验证串行）

***

## 6. M5+ — 增量项

实际完成顺序（按性价比，非 roadmap 原序号）：

| # | 项 | 状态 | commit |
|---|---|---|---|
| M5.1 | 设置面板（API key / baseUrl / 队列 / 模型默认） | ✅ | `de02f0a` |
| M5.2 | 蒙版 / inpainting（MaskEditor 全屏画板） | ✅ | `5c26a98` |
| M5.3 | video-input + gen-video（含手动抽帧） | ✅ | `52c7d0c` |
| M5.4 | video-analyze（chat with vision，多帧分析） | ✅ | `98d2d53` |
| M5.5 | Midjourney provider（imagine + 4 张切图） | ✅ | `8a5848e` |
| M5.6 | 角色/场景库 + generate-character/scene-image | ✅ | `40044e4` |
| M5.7 | extract-characters-scenes（LLM 抽取 + 入库） | ✅ | `4608e66` |
| M5.8 | storyboard-node（多 shot 编排） | ✅ | `837f69f` |
| — | 布局重构（Header + 左侧垂直 Toolbar） | ✅ | `ba9fd61` |
| M5.9 | 生成历史面板（左抽屉，IDB 持久化） | ✅ | `735dbba` |
| M5.10 | generate-character/scene-video | ✅ | `2f24556` |
| M5.11 | 自定义模型库（用户 CRUD + 节点合并下拉） | ✅ | `b4be8ce` |

剩余项（V3.8.8 对比缺口，详见 §1.1 / §1.2）：

- P0：novel-input 闭环 · 导出 ZIP / 批量下载 · local-save 本地服务
- P1：character-description / scene-description · image-compare compositions · Midjourney U/V · 配置节点化
- P2：storyboard-as-video / storyboard-download · `/v1/characters` 远端兼容评估
- P3：暗色主题（用户已要求保留浅色，暂缓）

约定：如果用户明确要求提交，每个里程碑独立 commit，message 形如 `feat: implement M5.X`；用户未要求时不要主动执行 git commit / branch 操作。

***

## 7. 给新会话 Claude 的提示词模板

如果你换终端新起对话，可以贴这段：

```text
我在 ~/xxl/node-canvas-studio 工作。请：
1. cd 进去，看 docs/roadmap.md 找到当前里程碑
2. 先读 docs/architecture.md 和 docs/node-types.md
3. 按 roadmap 的下一个 in-progress 里程碑继续。先告诉我你打算改哪些文件，得到我同意再动手。
4. 每个子任务做完跑一次 bun run typecheck，确保不破。
5. 一个里程碑跑完不要直接进下一个，停下让我验收。
```

⠀

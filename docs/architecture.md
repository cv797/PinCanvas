# 架构总览

本文档是从 `_legacy/` 中的单文件 HTML 反推得到的系统模型，作为后续 TypeScript 重写的输入。
不直接拷贝原代码；下游所有命名、API 形状、模块边界都以本组文档为准。

## 1. 顶层数据模型

整个应用的"状态"由三部分组成：

```ts
type Project = {
  nodes: Node[];          // 节点列表（画布上的卡片）
  connections: Edge[];    // 连线（有向边，可成 DAG）
  meta: ProjectMeta;      // 项目名、最后保存时间、自动保存元数据
};

type Node = {
  id: string;
  type: NodeType;         // 见 docs/node-types.md
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  settings: NodeSettings; // 由 type 决定的判别联合（见 node-types.md）
  // 运行态字段（不持久化或单独持久化均可）：
  content?: string | null;       // 预览节点的输出 URL / dataURL
  mjImages?: string[];           // Midjourney 4 张分割图
  mjNeedsSplit?: boolean;
  mjOriginalUrl?: string;
};

type Edge = {
  from: NodeId;
  to: NodeId;
  // 不见 fromHandle / toHandle，原版默认整节点连线
};
```

> **关键约束**：节点之间的关系是 **有向图**，不一定是树；同一个上游节点可以被多个下游引用，下游也可以接收多个上游。
> **连接点语义**：所有节点统一遵循 **左侧输入、右侧输出**。视觉连线应表达为 `上游节点右侧输出 -> 下游节点左侧输入`；左侧 handle 接收素材 / 引用 / 配置 / 文本等上游输入，右侧 handle 暴露当前节点产物给下游。新增节点不得反转该语义。

## 2. 状态分层

```
┌─────────────────────────────────────────────────────────────┐
│ React 内存状态（Zustand store）                              │
│  - nodes, connections                                       │
│  - selection, viewport, dragState                           │
│  - generationTasks（运行态队列）                              │
└──────────────┬──────────────────────────────────┬───────────┘
               │ 序列化                            │ 撤销栈
               ▼                                  ▼
┌──────────────────────────────┐    ┌───────────────────────┐
│ localStorage（≤ ~5MB）        │    │ 内存栈（zundo 中间件）│
│  - 偏好键 tapnow_*            │    │  - 默认上限 256       │
│  - 小型快照（节点元数据）       │    │  - 受 max_undo_steps │
└──────────────────────────────┘    └───────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ IndexedDB（idb-keyval / 原生）                                │
│  - autosave_db: 完整项目快照（含 dataURL 图片）               │
│  - images_db: 大图缓存                                       │
└──────────────────────────────────────────────────────────────┘
```

**写策略**：
- 偏好键（最近模型、并发数、性能模式）→ 立即写 localStorage
- 项目快照 → debounce 1-2s 后写 IDB
- 用户手动保存 → 立即写 IDB + 更新 localStorage 元数据

**读策略**：启动时先读 IDB 快照，若不存在再回退到 localStorage。

## 3. 撤销栈

- 容量由 `tapnow_max_undo_steps` 控制（典型值 256-512）
- 数据形式：`{ nodes, connections, timestamp }`
- 推入时机：每次会改变结构的操作（增删节点/连线、settings 变更、批量操作完成）
- **不**进入撤销栈：纯视图变更（缩放、平移、选中）、运行态字段（progress、isGenerating）

> **重写实现**：使用 [`zundo`](https://github.com/charkour/zundo) 作为 Zustand 中间件，配合 `partialize` 把运行态字段从快照里剔除，避免栈被噪声占满。

## 4. 自动保存

```ts
// 伪代码
const debouncedSave = debounce(async () => {
  if (!localStorage.tapnow_autosave) return;
  const snapshot = { nodes, connections, meta, timestamp: Date.now() };
  await idb.set('autosave_db', snapshot);
  localStorage.tapnow_autosave_meta = JSON.stringify({
    timestamp: snapshot.timestamp,
    storage: 'idb',
  });
}, 1500);

// 订阅 store，状态变化即触发
store.subscribe(debouncedSave);
```

启动时：
1. 读 `tapnow_autosave_meta` → 找到最近一次保存时间
2. 从 IDB 加载快照 → hydrate 到 store
3. 失败则回退到 localStorage 小快照（仅元数据 + 连线，不含大图）

## 5. 并发队列（生成任务调度）

```ts
type GenerationTask = {
  id: string;
  nodeId: NodeId;        // 触发任务的节点
  type: 'image' | 'video' | 'chat';
  status: 'pending' | 'running' | 'polling' | 'completed' | 'failed';
  startedAt?: number;
  payload: unknown;      // 已构造的请求体
  pollUrl?: string;      // 异步任务的轮询地址
  progress?: number;
  error?: string;
};
```

调度参数（持久化在 localStorage）：

| 键 | 含义 | 默认 |
|---|---|---|
| `tapnow_batch_queue_mode` | `parallel` / `serial` | `parallel` |
| `tapnow_batch_concurrency` | 并发上限 | `1` |
| `tapnow_image_concurrency` | 图片专用并发上限 | 同上 |

调度逻辑：
1. 用户点"生成" → 构造 `GenerationTask` 入队
2. 调度器扫描 pending 任务，若 `running.size < concurrency` 则启动
3. 启动后调用 `api/dispatch.ts` 选择端点（见 `api-contract.md` 与 `model-routing.md`）
4. 完成 / 失败 → 写回节点 settings、推动下一个任务
5. 异步模型（如 `nano-banana-2`、Sora）走单独的 `polling` 状态，按指数退避轮询

## 6. 上游反查（核心）

这是"上一张图片引用到下一张"的实现机制。

```ts
function resolveUpstream(nodeId: NodeId, conns: Edge[], nodes: NodeMap): Upstream {
  const incoming = conns.filter((c) => c.to === nodeId);
  const refs: string[] = [];
  let prompt = '';
  let mask: string | null = null;
  for (const e of incoming) {
    const up = nodes.get(e.from);
    if (!up) continue;
    switch (up.type) {
      case 'input-image':
      case 'preview':
        if (up.content) refs.push(up.content);
        break;
      case 'gen-image':
        // 取该节点最近一次成功输出（来源于 generationTasks 历史）
        const last = lastCompletedOutput(up.id);
        if (last?.url) refs.push(last.url);
        break;
      case 'text-node':
        if (up.settings.text) prompt = up.settings.text;
        break;
      case 'storyboard-node':
        const first = up.settings.shots?.[0];
        if (first?.imageUrl) refs.push(first.imageUrl);
        break;
      case 'video-input':
        // 视频帧可作为图生图的参考
        const frames = up.settings.selectedKeyframes ?? up.settings.frames;
        if (frames?.[0]?.url) refs.push(frames[0].url);
        break;
    }
  }
  return { referenceImages: refs.slice(0, 5), prompt, mask };
}
```

**约束**：
- `referenceImages` 上限 5 张（原版硬编码）
- 顺序：按 `conns` 顺序 + 同节点多张图按数组顺序
- 多张时：触发 `useMultiRef = true`，端点切到 `/v1/images/edits`

## 7. 模块切分（重写目标）

```
src/
├── api/
│   ├── client.ts           # 通用 fetch 封装 + 401/429 处理
│   ├── images.ts           # generations / edits（含异步）
│   ├── videos.ts           # videos/generations 与轮询
│   ├── chat.ts             # chat/completions
│   ├── local.ts            # /ping /save-cache /save-batch /pick-path
│   ├── model-routing.ts    # 见 docs/model-routing.md
│   └── template.ts         # {{var:format}} 模板引擎
├── canvas/
│   ├── Canvas.tsx          # xyflow 容器
│   ├── nodes/              # 一种节点类型一个文件
│   └── edges/              # 自定义 Edge（若需要）
├── store/
│   ├── canvas.ts           # nodes / connections / undo
│   ├── tasks.ts            # 任务队列 + 调度
│   ├── persistence.ts      # IDB / localStorage 适配器
│   └── prefs.ts            # tapnow_* 偏好键
├── types/
│   ├── node.ts             # 判别联合
│   ├── api.ts              # 请求/响应
│   └── model.ts            # 模型库结构
├── hooks/
│   ├── useUpstream.ts      # 上游反查
│   ├── useGenerationTrigger.ts
│   └── useAutosave.ts
└── utils/
    ├── debounce.ts
    ├── id.ts
    └── format.ts
```

## 8. 不在 M0~M4 范围、但需要提前留口子的能力

- 模型库管理 UI（M5+ 才做，但 `tapnow_model_library` 的结构现在就要定）
- 性能模式（normal / ultra）→ 现在只读 + 透传，不实装差异化渲染
- Midjourney 4 张分割图 → 节点输出字段 `mjImages` 先保留
- Storyboard 多镜头 → 节点 schema 包含 `shots` 数组，但 M2 暂不渲染
- 国际化 → 先全中文硬编码，留 `t('x')` 包装函数桩

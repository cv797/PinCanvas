# 持久化

三层：内存 store（Zustand）/ localStorage（偏好 + 小快照）/ IndexedDB（项目快照 + 大图）。
本文件给出 **完整键清单 + 迁移建议 + 重写目标 schema**。

## 1. localStorage 键清单（已观察到 40+）

> 重写时**保留键名**，确保旧用户从 _legacy/ HTML 切到新工程时数据不丢；但内部 store 用语义化字段，仅在 `persistence` 层做转换。

### 1.1 偏好 / 最近使用
| 键 | 类型 | 含义 |
|---|---|---|
| `tapnow_last_image_model` | string | 上次使用的图片模型 ID（默认 `nano-banana`） |
| `tapnow_last_video_model` | string | 上次使用的视频模型 ID（默认 `sora-2`） |
| `tapnow_last_analyze_model` | string | 上次使用的视频分析模型 |
| `tapnow_last_extract_model` | string | 上次使用的角色 / 场景抽取模型 |
| `tapnow_last_ratio` | string | 上次宽高比，如 `16:9` |
| `tapnow_last_image_res` | string | 上次图片分辨率 |
| `tapnow_last_video_res` | string | 上次视频分辨率 |
| `tapnow_last_segment_duration` | string | 上次视频时长 |
| `tapnow_chat_model` | string | 默认聊天模型 |
| `tapnow_theme` | `'light' \| 'dark'` | 主题 |

### 1.2 项目结构（仅小型回退快照）
| 键 | 类型 | 含义 |
|---|---|---|
| `tapnow_project_name` | string | 当前项目名 |
| `tapnow_nodes` | JSON | 节点列表（不含 dataURL 图，避免 5MB 上限）|
| `tapnow_connections` | JSON | 连线 |
| `tapnow_history` | JSON | 撤销栈快照（容量受 max_undo_steps） |
| `tapnow_autosave` | `'true' \| 'false'` | 自动保存开关 |
| `tapnow_autosave_meta` | JSON | `{ timestamp, storage: 'idb' \| 'local' }` |
| `tapnow_max_undo_steps` | string (number) | 撤销栈上限（默认 256） |

### 1.3 队列 / 性能
| 键 | 类型 | 含义 |
|---|---|---|
| `tapnow_batch_queue_mode` | `'parallel' \| 'serial'` | 队列模式 |
| `tapnow_batch_concurrency` | string (number) | 并发上限 |
| `tapnow_image_concurrency` | string (number) | 图片专属并发 |
| `tapnow_concurrency` | string (number) | 通用并发兜底 |
| `tapnow_global_performance_mode` | `'normal' \| 'ultra'` | 性能模式 |
| `tapnow_performance_mode` | 同上 | 当前会话模式（运行态镜像） |
| `tapnow_history_performance_mode` | 同上 | 历史记录性能模式 |
| `tapnow_history_limit` | string (number) | 历史记录上限 |
| `tapnow_save_history_assets` | `'true' \| 'false'` | 是否保存历史中的图片 / 视频 |

### 1.4 API / Provider
| 键 | 类型 | 含义 |
|---|---|---|
| `tapnow_global_key` | string | 兜底 API Key（任何 model 未配 apiConfig 时用） |
| `tapnow_api_configs` | JSON | `{ [provider]: { url, key, ... } }` |
| `tapnow_api_blacklist` | JSON | 临时禁用 endpoint |
| `tapnow_api_suspend` | JSON | 临时挂起（冷却中等） |
| `tapnow_providers` | JSON | provider 启用状态 |
| `tapnow_model_library` | JSON | 用户自定义模型库 |
| `tapnow_model_library_collapsed` | `'true' \| 'false'` | UI 折叠态 |
| `tapnow_jimeng_use_local_file` | `'true' \| 'false'` | Jimeng 强制本地文件上传 |
| `tapnow_native_multi_image_capabilities` | JSON | 多图能力探测缓存 |

### 1.5 本地服务
| 键 | 类型 | 含义 |
|---|---|---|
| `tapnow_local_server_url` | string | 本地缓存服务 URL（如 ComfyUI / 自建） |
| `tapnow_local_cache_enabled` | `'true' \| 'false'` | 是否启用本地缓存 |
| `tapnow_cache_redownload_on_enable` | `'true' \| 'false'` | 启用时是否重新下载 |
| `tapnow_show_local_cache_banner` | `'true' \| 'false'` | 显示提示条 |

### 1.6 其他
| 键 | 类型 | 含义 |
|---|---|---|
| `tapnow_images_db` | string | 图片缓存 IDB 数据库名 |
| `tapnow_autosave_db` | string | 自动保存 IDB 数据库名 |
| `tapnow_chat_sessions` | JSON | 聊天会话列表 |
| `tapnow_characters` | JSON | 角色库缓存 |
| `tapnow_prompt_library` | JSON | 提示词库 |
| `tapnow_asset_bundle_meta` | JSON | 资源包元数据 |
| `tapnow_debug_storyboard` | `'true' \| 'false'` | 调试分镜开关 |

## 2. IndexedDB

```ts
// src/store/persistence.ts
import { createStore, get, set, del, keys } from 'idb-keyval';

const autosaveDb = createStore('tapnow-autosave', 'snapshots');
const imagesDb   = createStore('tapnow-images',   'assets');

// 项目快照（完整）
interface ProjectSnapshot {
  version: 1;
  savedAt: number;
  projectName: string;
  nodes: Node[];
  connections: Edge[];
  /** 若内嵌 dataURL 则存这里；否则放 imagesDb，节点里写 assetId */
  assetIdsByNode: Record<NodeId, string[]>;
}
```

**两种持久化策略**（按 `tapnow_save_history_assets` 开关）：

| 模式 | nodes 内的 image 字段 | assets 表 |
|---|---|---|
| 节省 | 写 `assetId:abc123`，原始 dataURL 抽出 | 写 `{ id, blob }` |
| 完整 | 直接写 dataURL（方便分享） | 不用 |

## 3. 加载 / 保存流程

```
应用启动
  ├─ 读 tapnow_autosave_meta → 找到最近快照
  ├─ 从 IDB 加载 ProjectSnapshot
  ├─ hydrate Zustand store
  └─ 设置 store.subscribe(debouncedSave)

debouncedSave (1.5s)
  ├─ 序列化 store → ProjectSnapshot
  ├─ 写 IDB
  ├─ 写 localStorage：tapnow_autosave_meta = { timestamp, storage: 'idb' }
  └─ 写 localStorage：tapnow_nodes / tapnow_connections（去图片版，作为兜底）
```

## 4. 迁移：从 _legacy/ HTML 到新工程

新工程**复用所有 `tapnow_*` 键**，因此：
- 首次启动检查 `tapnow_nodes` / `tapnow_connections` / IDB `tapnow-autosave`
- 若旧数据存在 → 调用 `migrate(v0 → v1)` 把旧节点 `settings` 字段映射到新 `kind` 判别联合
- 显示一次性提示："已从旧版本恢复 N 个节点"

**已知字段重命名**：
- 无显式 rename，原版字段直接采用（`referenceImages`, `model`, `ratio` 等）。
- 唯一新增：`settings.kind` 用于判别（旧版没有，由 `node.type` 推导填入）。

## 5. localStorage 5MB 上限对策

原版会在快照变大时丢部分内容（仅存连线 / 节点元数据）。重写时：
- 偏好键保持小（< 100KB）
- 项目快照**只走 IDB**，localStorage 只放 `autosave_meta`
- 撤销栈也只在内存，必要时把"已保存的撤销点"序列化到 IDB（M5+）

## 6. 重写 API

```ts
// src/store/prefs.ts
export const prefs = {
  get<T>(key: PrefKey, fallback: T): T,
  set<T>(key: PrefKey, value: T): void,
  watch<T>(key: PrefKey, cb: (v: T) => void): () => void,
};

// src/store/persistence.ts
export const persistence = {
  loadSnapshot(): Promise<ProjectSnapshot | null>,
  saveSnapshot(s: ProjectSnapshot): Promise<void>,
  putAsset(blob: Blob): Promise<AssetId>,
  getAsset(id: AssetId): Promise<Blob | null>,
  deleteAsset(id: AssetId): Promise<void>,
  listSnapshots(): Promise<SnapshotMeta[]>,  // M5+
};
```

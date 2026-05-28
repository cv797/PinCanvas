# XXL Canvas 多用户协同功能可行性报告

**文档版本**: v1.0\
**编写日期**: 2026-05-19\
**目标功能**: 用户中心、存储中心、项目管理、协同办公、共同参片

***

## 一、执行摘要

### 1.1 项目背景

XXL Canvas 当前是一个**单机版 AI 创作工具**，所有数据存储在浏览器 IndexedDB 中。为了支持团队协作和跨设备使用，需要升级为**多用户协同平台**。

### 1.2 核心目标

| 功能模块     | 核心价值             | 优先级     |
| -------- | ---------------- | ------- |
| **用户中心** | 身份认证、个人资料管理      | P0 (基础) |
| **存储中心** | 统一媒体资源管理、CDN 加速  | P0 (基础) |
| **项目管理** | 多项目切换、版本历史、项目分享  | P0 (基础) |
| **协同办公** | 实时多人编辑、冲突解决、权限控制 | P1 (增强) |
| **共同参片** | 团队素材库、资源复用、评论批注  | P1 (增强) |

### 1.3 可行性结论

✅ **技术可行** - 当前架构设计良好，支持渐进式升级\
✅ **成本可控** - 预估 3-6 个月完成核心功能\
⚠️ **风险可控** - 需要处理数据迁移和并发冲突问题

***

## 二、当前架构分析

### 2.1 技术栈现状

```text
前端: React 18 + TypeScript + Zustand + xyflow
持久化: IndexedDB (idb-keyval) + localStorage
后端: Bun server (静态资源 + 媒体代理)
测试: Vitest + MSW
```

### 2.2 架构优势

✅ **状态管理清晰** - Zustand + Immer，易于扩展\
✅ **数据模型完善** - 节点类型系统、上游反查机制成熟\
✅ **已有后端基础** - Bun server 可直接扩展为 API 服务\
✅ **测试覆盖良好** - 41 个测试用例，便于重构

### 2.3 架构瓶颈

❌ **单机存储** - IndexedDB 无法跨设备同步\
❌ **无用户体系** - 缺少身份认证和权限控制\
❌ **资源管理混乱** - dataURL 直接存储，占用大量内存\
❌ **无协同机制** - 多人编辑会产生冲突

***

## 三、技术方案设计

### 3.1 整体架构演进

```text
┌─────────────────────────────────────────────────────────────┐
│                      当前架构 (单机版)                        │
├─────────────────────────────────────────────────────────────┤
│  浏览器 → IndexedDB (本地) → 单用户单设备                     │
└─────────────────────────────────────────────────────────────┘

                            ↓ 升级

┌─────────────────────────────────────────────────────────────┐
│                      目标架构 (协同版)                        │
├─────────────────────────────────────────────────────────────┤
│  浏览器 (React)                                              │
│    ↕ HTTP/REST                                              │
│  API 网关 (Bun + Hono)                                       │
│    ↕                                                         │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ 用户服务 │ 项目服务 │ 存储服务 │ 协同服务 │             │
│  └──────────┴──────────┴──────────┴──────────┘             │
│    ↕                    ↕          ↕                         │
│  PostgreSQL          Redis      对象存储(OSS)               │
│                        ↕                                     │
│                   WebSocket (实时同步)                       │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心技术选型

| 层次       | 技术选型            | 理由                   |
| -------- | --------------- | -------------------- |
| **后端框架** | Go + Gin        | 高并发性能优秀，生态成熟，适合协同编辑场景 |
| **数据库**  | PostgreSQL      | 成熟稳定，支持 JSONB 存储画布数据 |
| **缓存**   | Redis           | 会话管理、实时在线状态          |
| **对象存储** | 阿里云 OSS / S3    | 媒体资源 CDN 加速          |
| **实时通信** | Gorilla WebSocket + Yjs | Goroutine 天生支持高并发连接 |
| **认证**   | JWT + OAuth 2.0 | 无状态 token，支持第三方登录    |

**技术选型说明**:
- 选择 Go 而非 Bun 的原因：
  1. 协同办公需要维护大量 WebSocket 连接，Go 的 Goroutine 并发模型更适合
  2. 现有后端代码量小 (515 行)，重写成本低 (2-3 天)
  3. Go 生态更成熟，企业级库更丰富
  4. 部署更简单，编译成单二进制文件，无运行时依赖

***

## 四、功能模块详细设计

### 4.1 用户中心

#### 功能清单

* [ ] 用户注册/登录 (邮箱 + 密码)
* [ ] 第三方登录 (微信/GitHub/Google)
* [ ] 个人资料管理 (头像、昵称、邮箱)
* [ ] 密码找回/修改
* [ ] 会话管理 (多设备登录)
* [ ] 账号注销

#### 数据模型

```typescript
interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  createdAt: number;
  lastLoginAt: number;
  
  // 扩展字段
  teamIds: string[];        // 所属团队
  storageQuota: number;     // 存储配额 (字节)
  storageUsed: number;      // 已用存储
}
```

#### API 设计

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/users/me
PATCH  /api/users/me
POST   /api/auth/reset-password
```

#### 工作量评估

* 后端开发: 3-5 天

* 前端开发: 3-5 天

* 测试: 2 天

* **总计**: 8-12 天

***

### 4.2 存储中心

#### 功能清单

* [ ] 媒体资源上传 (图片/视频)
* [ ] 资源列表管理 (按项目/类型筛选)
* [ ] 资源预览/下载
* [ ] 资源删除/批量删除
* [ ] 存储配额管理
* [ ] CDN 加速访问
* [ ] 资源引用计数 (防止误删)

#### 数据模型

```typescript
interface MediaAsset {
  id: string;
  userId: string;
  projectId?: string;       // 所属项目
  name: string;
  mediaType: 'image' | 'video' | 'audio';
  contentType: string;      // MIME type
  sizeBytes: number;
  objectKey: string;        // OSS 对象键
  cdnUrl: string;           // CDN 访问地址
  
  // 元数据
  width?: number;
  height?: number;
  duration?: number;        // 视频时长
  
  // 引用管理
  refCount: number;         // 被多少个节点引用
  
  createdAt: number;
  updatedAt: number;
}
```

#### API 设计

```text
POST   /api/media/upload
GET    /api/media
GET    /api/media/:id
DELETE /api/media/:id
POST   /api/media/batch-delete
GET    /api/media/quota
```

#### 资源 URL 迁移方案

```typescript
// 当前: 节点直接存 dataURL
settings: {
  referenceImages: [
    "data:image/png;base64,iVBORw0KG..."  // 占用大量内存
  ]
}

// 升级后: 存储资源 ID，按需加载
settings: {
  referenceImages: [
    {
      id: "media_abc123",
      url: "https://cdn.example.com/media/abc123.png",  // 缓存
      source: "remote"
    }
  ]
}
```

#### 工作量评估

* 后端开发: 5-7 天 (含 OSS 集成)

* 前端开发: 4-6 天

* 数据迁移脚本: 2-3 天

* 测试: 3 天

* **总计**: 14-19 天

***

### 4.3 项目管理

#### 功能清单

* [ ] 项目列表页 (我的项目/团队项目/共享项目)
* [ ] 创建/删除/重命名项目
* [ ] 项目详情页 (元数据、成员、历史)
* [ ] 项目复制 (fork)
* [ ] 项目导出 (ZIP 包)
* [ ] 项目分享 (生成分享链接)
* [ ] 版本历史 (自动快照)
* [ ] 项目搜索/筛选

#### 数据模型

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  teamId?: string;
  
  // 可见性
  visibility: 'private' | 'team' | 'public';
  
  // 权限列表
  permissions: Array<{
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
  }>;
  
  // 统计信息
  nodeCount: number;
  assetCount: number;
  sizeBytes: number;
  
  // 时间戳
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  
  // 缩略图
  thumbnail?: string;
}

interface ProjectSnapshot {
  id: string;
  projectId: string;
  version: number;
  nodes: AppNode[];
  edges: AppEdge[];
  createdAt: number;
  createdBy: string;
  comment?: string;         // 版本说明
}
```

#### API 设计

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id

GET    /api/projects/:id/snapshot
PUT    /api/projects/:id/snapshot
GET    /api/projects/:id/history
POST   /api/projects/:id/fork
POST   /api/projects/:id/share
```

#### 前端路由调整

```typescript
// 当前: 单页应用，无路由
/

// 升级后: 多页面路由
/                          // 首页 (未登录: 落地页, 已登录: 项目列表)
/projects                  // 项目列表
/projects/:id              // 项目画布 (当前的主界面)
/projects/:id/settings     // 项目设置
/projects/:id/history      // 版本历史
/profile                   // 个人中心
/team/:id                  // 团队空间
```

#### 工作量评估

* 后端开发: 6-8 天

* 前端开发: 8-10 天 (含路由改造)

* 数据迁移: 3-4 天

* 测试: 3 天

* **总计**: 20-25 天

***

### 4.4 协同办公

#### 功能清单

* [ ] 实时多人编辑 (看到其他人的光标和操作)
* [ ] 操作冲突自动解决 (CRDT 算法)
* [ ] 节点编辑锁 (防止同时编辑)
* [ ] 在线用户列表
* [ ] 操作历史回放
* [ ] 评论/批注系统
* [ ] @提及通知
* [ ] 权限控制 (只读/编辑/管理)

#### 技术方案: Yjs + WebSocket

```typescript
// Yjs 集成
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const ydoc = new Y.Doc();
const yNodes = ydoc.getArray<AppNode>('nodes');
const yEdges = ydoc.getArray<AppEdge>('edges');

// 连接到 WebSocket 服务器
const provider = new WebsocketProvider(
  'wss://api.example.com/sync',
  projectId,
  ydoc
);

// 监听远程变更
yNodes.observe(() => {
  const nodes = yNodes.toArray();
  useCanvas.getState().hydrate({ nodes, edges: yEdges.toArray() });
});

// 本地变更同步到远程
useCanvas.subscribe((state) => {
  ydoc.transact(() => {
    yNodes.delete(0, yNodes.length);
    yNodes.push(state.nodes);
  });
});
```

#### 冲突解决策略

| 场景       | 解决方案            |
| -------- | --------------- |
| 同时编辑不同节点 | 无冲突，直接合并        |
| 同时编辑同一节点 | Yjs 自动合并 (CRDT) |
| 同时删除同一节点 | 以最后操作为准         |
| 同时移动同一节点 | 显示冲突提示，用户手动解决   |

#### 权限控制

```typescript
interface NodePermission {
  canView: string[];        // 可查看的用户 ID
  canEdit: string[];        // 可编辑的用户 ID
  isLocked: boolean;        // 是否锁定
  lockedBy?: string;        // 锁定者
}

// 在节点组件中检查权限
function GenImageNode({ data }: NodeProps) {
  const currentUser = useUser(s => s.currentUser);
  const canEdit = data.permissions?.canEdit.includes(currentUser.id);
  
  return (
    <textarea
      disabled={!canEdit}
      placeholder={canEdit ? "输入 prompt" : "无编辑权限"}
    />
  );
}
```

#### 工作量评估

* 后端开发: 8-10 天 (WebSocket 服务器)

* 前端开发: 10-12 天 (Yjs 集成 + UI)

* 冲突测试: 5 天

* 性能优化: 3 天

* **总计**: 26-30 天

***

### 4.5 共同参片 (团队素材库)

#### 功能清单

* [ ] 团队素材库 (共享图片/视频)
* [ ] 素材分类/标签
* [ ] 素材搜索 (按名称/标签/类型)
* [ ] 素材评论/批注
* [ ] 素材版本管理
* [ ] 素材使用统计
* [ ] 一键引用到画布

#### 数据模型

```typescript
interface TeamAsset extends MediaAsset {
  teamId: string;
  tags: string[];
  category: string;
  
  // 协作信息
  comments: Array<{
    id: string;
    userId: string;
    content: string;
    createdAt: number;
  }>;
  
  // 使用统计
  usageCount: number;
  lastUsedAt: number;
  usedInProjects: string[];
}
```

#### API 设计

```text
GET    /api/teams/:id/assets
POST   /api/teams/:id/assets/upload
PATCH  /api/teams/:id/assets/:assetId
DELETE /api/teams/:id/assets/:assetId

POST   /api/teams/:id/assets/:assetId/comments
GET    /api/teams/:id/assets/:assetId/usage
```

#### 工作量评估

* 后端开发: 4-6 天

* 前端开发: 6-8 天

* 测试: 2 天

* **总计**: 12-16 天

***

## 五、实施路线图

### 阶段 0: 架构准备 (3 周)

**目标**: 重构现有代码，为多用户功能打基础

* [ ] **后端重写为 Go** (2-3 天)
  * 使用 Gin 框架重写现有 515 行 Bun 代码
  * 保持 API 接口不变，前端无需改动
  * 搭建 Go 项目结构和工具链
* [ ] 引入 Repository 模式 (抽象持久化层)
* [ ] 项目元数据扩展 (添加 id、ownerId、permissions 字段)
* [ ] 资源 URL 标准化 (支持本地/远程双模式)
* [ ] 前端路由改造 (React Router)
* [ ] 数据库 schema 设计 (PostgreSQL)

**交付物**:

* Go 后端服务 (替换 Bun)

* 重构后的前端代码 (向后兼容)

* API 框架骨架

* 数据库 schema 设计

***

### 阶段 1: 用户中心 + 存储中心 (4 周)

**目标**: 用户可以注册登录，上传资源到云端

* [ ] 用户注册/登录功能
* [ ] JWT 认证中间件
* [ ] 媒体上传 API (OSS 集成)
* [ ] 前端登录页/个人中心页
* [ ] 资源管理页面

**交付物**:

* 可用的用户系统

* 云端存储功能

* 数据迁移工具 (本地 → 云端)

***

### 阶段 2: 项目管理 (4 周)

**目标**: 用户可以创建多个项目，跨设备同步

* [ ] 项目 CRUD API
* [ ] 项目列表页
* [ ] 项目详情页
* [ ] 版本历史功能
* [ ] 项目分享功能

**交付物**:

* 完整的项目管理系统

* 自动同步机制

* 版本回滚功能

***

### 阶段 3: 协同办公 (6 周)

**目标**: 多人可以同时编辑一个项目

* [ ] WebSocket 服务器
* [ ] Yjs 集成
* [ ] 实时光标显示
* [ ] 冲突解决机制
* [ ] 权限控制系统

**交付物**:

* 实时协同编辑功能

* 权限管理界面

* 冲突解决测试报告

***

### 阶段 4: 共同参片 (3 周)

**目标**: 团队可以共享素材库

* [ ] 团队素材库
* [ ] 素材评论系统
* [ ] 素材搜索/筛选
* [ ] 使用统计

**交付物**:

* 团队素材库功能

* 素材管理界面

***

### 总工期估算

| 阶段          | 工期  | 累计              |
| ----------- | --- | --------------- |
| 阶段 0: 架构准备  | 3 周 | 3 周             |
| 阶段 1: 用户+存储 | 4 周 | 7 周             |
| 阶段 2: 项目管理  | 4 周 | 11 周            |
| 阶段 3: 协同办公  | 6 周 | 17 周            |
| 阶段 4: 共同参片  | 3 周 | 20 周            |
| **缓冲时间**    | 4 周 | **24 周 (6 个月)** |

***

## 六、风险评估与应对

### 6.1 技术风险

| 风险                  | 影响 | 概率 | 应对措施               |
| ------------------- | -- | -- | ------------------ |
| **数据迁移失败**          | 高  | 中  | 提供本地备份功能，支持回滚      |
| **协同冲突频繁**          | 中  | 高  | 使用成熟的 Yjs 库，充分测试   |
| **性能下降**            | 中  | 中  | 引入 Redis 缓存，CDN 加速 |
| **WebSocket 连接不稳定** | 中  | 中  | 实现断线重连，离线缓存        |

### 6.2 业务风险

| 风险          | 影响 | 概率 | 应对措施                 |
| ----------- | -- | -- | -------------------- |
| **用户不愿迁移**  | 高  | 低  | 保留本地模式，可选登录          |
| **存储成本过高**  | 中  | 中  | 设置存储配额，压缩资源          |
| **权限设计不合理** | 中  | 中  | 参考 Figma/Notion 权限模型 |

### 6.3 安全风险

| 风险       | 影响 | 概率 | 应对措施                |
| -------- | -- | -- | ------------------- |
| **数据泄露** | 高  | 低  | HTTPS + 数据加密 + 审计日志 |
| **账号被盗** | 中  | 中  | 双因素认证 (2FA)         |
| **恶意上传** | 中  | 中  | 文件类型检查 + 病毒扫描       |

***

## 七、成本估算

### 7.1 开发成本

| 项目     | 人力    | 工期   | 成本 (假设 1 人月 = 2 万) |
| ------ | ----- | ---- | ------------------ |
| 后端开发   | 1 人   | 4 个月 | 8 万                |
| 前端开发   | 1 人   | 4 个月 | 8 万                |
| 测试     | 0.5 人 | 2 个月 | 2 万                |
| **总计** | -     | -    | **18 万**           |

### 7.2 运营成本 (年)

| 项目         | 规格        | 成本 (年)        |
| ---------- | --------- | ------------- |
| 服务器 (ECS)  | 4 核 8G    | 5000 元        |
| 数据库 (RDS)  | 2 核 4G    | 3000 元        |
| Redis      | 1G        | 1000 元        |
| 对象存储 (OSS) | 1TB + CDN | 2000 元        |
| 域名 + SSL   | -         | 500 元         |
| **总计**     | -         | **11500 元/年** |

***

## 八、结论与建议

### 8.1 可行性结论

✅ **技术可行** - 当前架构设计良好，支持渐进式升级\
✅ **成本可控** - 开发成本约 18 万，运营成本约 1.2 万/年\
✅ **风险可控** - 主要风险有应对措施\
✅ **价值明确** - 多用户协同是刚需，市场空间大

### 8.2 实施建议

1. **优先级排序**: 用户中心 → 存储中心 → 项目管理 → 协同办公 → 共同参片

2. **渐进式发布**: 每个阶段独立上线，降低风险

3. **保留本地模式**: 未登录用户仍可使用本地功能

4. **充分测试**: 协同冲突、数据迁移需要重点测试

5. **用户反馈**: 每个阶段收集用户反馈，快速迭代

### 8.3 下一步行动

1. **评审本报告** - 确认需求和技术方案

2. **编写详细需求文档** - 每个功能模块的 PRD

3. **启动阶段 0** - 架构准备工作

4. **搭建开发环境** - 数据库、OSS、CI/CD

***

**报告编写人**: Claude (AI Assistant)\
**审核人**: 待定\
**批准人**: 待定

⠀
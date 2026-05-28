# XXL Canvas 开发路线图

**文档版本**: v2.0\
**更新日期**: 2026-05-19\
**战略方向**: 从单机工具升级为多用户协同平台

> 本路线图基于 `docs/feasibility-report.md` 制定。旧版路线图（单机版功能补齐）已归档至 `docs/roadmap-old.md`。

***

## 一、项目现状

### 1.1 已完成功能 (M0-M5.11)

✅ **核心画布系统**

* 节点式编辑器 (xyflow)

* 19 种节点类型

* 撤销/重做 (zundo)

* 自动保存 (IndexedDB)

✅ **AI 生成能力**

* 图片生成 (OpenAI 兼容 + Midjourney)

* 视频生成

* 视频分析

* 角色/场景库

* 分镜板

✅ **技术栈**

* 前端: React 18 + TypeScript + Zustand

* 后端: Bun server (515 行，仅静态资源 + 媒体代理)

* 测试: Vitest (41 个测试用例)

### 1.2 架构瓶颈

❌ **单机存储** - IndexedDB 无法跨设备同步\
❌ **无用户体系** - 缺少身份认证和权限控制\
❌ **资源管理混乱** - dataURL 直接存储，占用大量内存\
❌ **无协同机制** - 多人编辑会产生冲突

***

## 二、战略目标

### 2.1 核心目标

将 XXL Canvas 从**单机 AI 创作工具**升级为**多用户协同平台**，支持：

1. **用户中心** - 身份认证、个人资料管理

2. **存储中心** - 统一媒体资源管理、CDN 加速

3. **项目管理** - 多项目切换、版本历史、项目分享

4. **协同办公** - 实时多人编辑、冲突解决、权限控制

5. **共同参片** - 团队素材库、资源复用、评论批注

### 2.2 技术选型

| 层次       | 技术                      | 理由                |
| -------- | ----------------------- | ----------------- |
| **后端框架** | Go + Gin                | 高并发性能优秀，适合协同编辑    |
| **数据库**  | PostgreSQL              | 成熟稳定，支持 JSONB     |
| **缓存**   | Redis                   | 会话管理、在线状态         |
| **对象存储** | 阿里云 OSS / S3            | 媒体资源 CDN 加速       |
| **实时通信** | Gorilla WebSocket + Yjs | Goroutine 天生支持高并发 |
| **认证**   | JWT + OAuth 2.0         | 无状态 token，第三方登录   |

***

## 三、开发路线图

### 阶段 0: 架构准备 (3 周) - M6.0

**目标**: 重构现有代码，为多用户功能打基础

#### 核心任务

* [ ] **后端重写为 Go** (2-3 天)

  * 使用 Gin 框架重写现有 515 行 Bun 代码

  * 保持 API 接口不变，前端无需改动

  * 搭建 Go 项目结构：`cmd/`, `internal/`, `pkg/`

  * 重写现有 3 个 API：`/healthz`, `/api/storage/status`, `/api/user/media/library/*`

* [ ] **引入 Repository 模式** (2-3 天)

  * 抽象持久化层：`ProjectRepository`, `MediaRepository`

  * 实现 `LocalProjectRepository` (IDB 兼容)

  * 预留 `RemoteProjectRepository` 接口

* [ ] **项目元数据扩展** (1-2 天)

  * 在 `ProjectSnapshot` 中添加：`id`, `ownerId`, `visibility`, `permissions`

  * 修改 `src/store/persistence.ts` 自动填充新字段

  * 保持向后兼容

* [ ] **资源 URL 标准化** (2-3 天)

  * 定义 `ResourceRef` 类型：`{ id, url?, source: 'local' | 'remote' }`

  * 修改节点 `referenceImages` 字段类型

  * 实现 `resolveResourceUrl()` 统一解析函数

* [ ] **前端路由改造** (3-4 天)

  * 引入 React Router

  * 设计路由结构：`/`, `/projects`, `/projects/:id`, `/profile`

  * 保持当前画布页为 `/projects/:id`

* [ ] **数据库 Schema 设计** (2-3 天)

  * 设计表结构：`users`, `projects`, `media_assets`, `permissions`

  * 编写 SQL 迁移脚本

  * 搭建 PostgreSQL 开发环境

#### 验收标准

* [ ] Go 后端服务运行正常，前端功能不受影响
* [ ] `bun run typecheck` 通过
* [ ] 所有现有测试通过
* [ ] 数据库 Schema 评审通过

#### 交付物

* Go 后端服务 (替换 Bun)

* 重构后的前端代码 (向后兼容)

* 数据库 Schema 文档

* 迁移计划文档

***

### 阶段 1: 用户中心 + 存储中心 (4 周) - M6.1 & M6.2

**目标**: 用户可以注册登录，上传资源到云端

#### M6.1 用户中心 (2 周)

**后端开发** (1 周)

* [ ] 用户注册/登录 API
* [ ] JWT 认证中间件
* [ ] 密码加密 (bcrypt)
* [ ] 会话管理 (Redis)
* [ ] 第三方登录 (OAuth 2.0 框架)

**前端开发** (1 周)

* [ ] 登录页 (`/login`)
* [ ] 注册页 (`/register`)
* [ ] 个人中心页 (`/profile`)
* [ ] 全局用户状态管理 (`src/store/user.ts`)
* [ ] 认证拦截器

**API 设计**

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/users/me
PATCH  /api/users/me
POST   /api/auth/reset-password
```

#### M6.2 存储中心 (2 周)

**后端开发** (1 周)

* [ ] OSS SDK 集成 (阿里云 OSS / AWS S3)
* [ ] 媒体上传 API (支持分片上传)
* [ ] 媒体列表/删除 API
* [ ] 存储配额管理
* [ ] CDN URL 生成

**前端开发** (1 周)

* [ ] 资源管理页 (`/media`)
* [ ] 上传组件 (支持拖拽、进度条)
* [ ] 资源预览/下载
* [ ] 配额显示

**数据迁移**

* [ ] 编写脚本：dataURL → OSS
* [ ] 批量上传工具
* [ ] 回滚机制

**API 设计**

```text
POST   /api/media/upload
GET    /api/media
GET    /api/media/:id
DELETE /api/media/:id
POST   /api/media/batch-delete
GET    /api/media/quota
```

#### 验收标准

* [ ] 用户可以注册、登录、修改资料
* [ ] 用户可以上传图片/视频到云端
* [ ] 资源通过 CDN 访问
* [ ] 存储配额正确统计
* [ ] 数据迁移工具测试通过

***

### 阶段 2: 项目管理 (4 周) - M6.3

**目标**: 用户可以创建多个项目，跨设备同步

#### 核心任务

**后端开发** (2 周)

* [ ] 项目 CRUD API
* [ ] 项目快照存储 (PostgreSQL JSONB)
* [ ] 版本历史管理
* [ ] 项目分享 (生成分享链接)
* [ ] 权限控制 (owner/editor/viewer)

**前端开发** (2 周)

* [ ] 项目列表页 (`/projects`)
* [ ] 项目详情页 (`/projects/:id/settings`)
* [ ] 版本历史页 (`/projects/:id/history`)
* [ ] 项目切换逻辑
* [ ] 自动同步机制 (debounce 保存到云端)

**API 设计**

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

#### 验收标准

* [ ] 用户可以创建多个项目
* [ ] 项目在多设备间自动同步
* [ ] 版本历史可以回滚
* [ ] 项目分享链接可访问
* [ ] 权限控制生效

***

### 阶段 3: 协同办公 (6 周) - M6.4

**目标**: 多人可以同时编辑一个项目

#### 核心任务

**后端开发** (3 周)

* [ ] WebSocket 服务器 (Gorilla WebSocket)
* [ ] 房间管理 (按 projectId 分组)
* [ ] 在线用户列表 (Redis)
* [ ] 操作广播机制
* [ ] 断线重连处理

**前端开发** (2 周)

* [ ] Yjs 集成 (CRDT 冲突解决)
* [ ] WebSocket 连接管理
* [ ] 实时光标显示
* [ ] 在线用户列表 UI
* [ ] 节点编辑锁

**权限系统** (1 周)

* [ ] 节点级权限控制
* [ ] 权限检查中间件
* [ ] 权限管理 UI

#### 技术方案

```go
// WebSocket 服务器
type Room struct {
    ProjectID string
    Clients   map[string]*Client
    Broadcast chan *Message
}

func (r *Room) HandleMessage(msg *Message) {
    // 广播给房间内其他用户
    for _, client := range r.Clients {
        if client.UserID != msg.UserID {
            client.Send(msg)
        }
    }
}
```

```typescript
// Yjs 集成
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const ydoc = new Y.Doc();
const yNodes = ydoc.getArray<AppNode>('nodes');

const provider = new WebsocketProvider(
  'wss://api.example.com/sync',
  projectId,
  ydoc
);
```

#### 验收标准

* [ ] 多人可以同时编辑同一项目
* [ ] 操作实时同步，延迟 < 500ms
* [ ] 冲突自动解决，无数据丢失
* [ ] 断线重连后状态正确
* [ ] 权限控制生效

***

### 阶段 4: 共同参片 (3 周) - M6.5

**目标**: 团队可以共享素材库

#### 核心任务

**后端开发** (1.5 周)

* [ ] 团队素材库 API
* [ ] 素材评论系统
* [ ] 标签/分类管理
* [ ] 使用统计

**前端开发** (1.5 周)

* [ ] 团队素材库页面
* [ ] 素材搜索/筛选
* [ ] 评论 UI
* [ ] 一键引用到画布

**API 设计**

```text
GET    /api/teams/:id/assets
POST   /api/teams/:id/assets/upload
PATCH  /api/teams/:id/assets/:assetId
DELETE /api/teams/:id/assets/:assetId

POST   /api/teams/:id/assets/:assetId/comments
GET    /api/teams/:id/assets/:assetId/usage
```

#### 验收标准

* [ ] 团队成员可以共享素材
* [ ] 素材可以评论和标签
* [ ] 搜索功能正常
* [ ] 使用统计准确

***

## 四、总工期估算

| 阶段        | 工期  | 累计              | 优先级 |
| --------- | --- | --------------- | --- |
| M6.0 架构准备 | 3 周 | 3 周             | P0  |
| M6.1 用户中心 | 2 周 | 5 周             | P0  |
| M6.2 存储中心 | 2 周 | 7 周             | P0  |
| M6.3 项目管理 | 4 周 | 11 周            | P0  |
| M6.4 协同办公 | 6 周 | 17 周            | P1  |
| M6.5 共同参片 | 3 周 | 20 周            | P1  |
| **缓冲时间**  | 4 周 | **24 周 (6 个月)** | -   |

***

## 五、风险管理

### 5.1 技术风险

| 风险                | 影响 | 概率 | 应对措施        |
| ----------------- | -- | -- | ----------- |
| **Go 重写延期**       | 中  | 低  | 现有代码少，风险可控  |
| **数据迁移失败**        | 高  | 中  | 提供本地备份，支持回滚 |
| **协同冲突频繁**        | 中  | 高  | 使用成熟的 Yjs 库 |
| **WebSocket 不稳定** | 中  | 中  | 实现断线重连，离线缓存 |

### 5.2 业务风险

| 风险         | 影响 | 概率 | 应对措施        |
| ---------- | -- | -- | ----------- |
| **用户不愿迁移** | 高  | 低  | 保留本地模式，可选登录 |
| **存储成本过高** | 中  | 中  | 设置存储配额，压缩资源 |

***

## 六、成功指标

### 6.1 技术指标

* [ ] API 响应时间 < 200ms (P95)
* [ ] WebSocket 延迟 < 500ms
* [ ] 系统可用性 > 99.5%
* [ ] 测试覆盖率 > 80%

### 6.2 业务指标

* [ ] 用户注册转化率 > 30%
* [ ] 项目同步成功率 > 99%
* [ ] 协同编辑并发用户 > 100
* [ ] 存储成本 < 0.1 元/GB/月

***

## 七、参考文档

* `docs/feasibility-report.md` - 可行性报告（详细技术方案）

* `docs/roadmap-old.md` - 旧版路线图（单机版功能补齐）

* `docs/architecture.md` - 当前架构文档

* `docs/api-contract.md` - API 契约规范

***

**文档维护**: 每个里程碑完成后更新本文档\
**评审周期**: 每月评审一次，根据实际情况调整优先级

⠀
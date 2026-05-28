# 反向工程笔记

不写到 architecture / api-contract 等"成品"文档里的"现场证据"。
每条都注明信心等级与原始上下文，便于重写时核对。

> 信心等级：✅ 高（多处交叉验证） / 🟡 中（单处证据 + 合理推测） / 🟠 低（推测为主）

---

## 1. 节点尺寸常量 ✅

```js
t==="gen-image"?Math.min(860,340+Math.max(0,u-1)*36)
t==="gen-video"?Math.min(900,420+Math.max(0,u-1)*36)
```

含义：节点高度 = `base + (customParams.length - 1) × 36`，上限 860 / 900。
**重写**：xyflow 节点用 `auto height + maxHeight`，CSS 控制即可，不必硬编码。

## 2. 参考图 5 张上限 ✅

```js
const Xe = (lt.referenceImages.length > 0 ? lt.referenceImages : lt.image_url ? [lt.image_url] : []).slice(0,5);
return Xe.length < 5 ? Xe.push(Be) : Xe[0] = Be
```

含义：满 5 张时**替换第 1 张**（不是 push 也不是拒绝）。
**重写**：行为保留，但 UI 上提示"已达上限，将替换最早一张"。

## 3. 上游节点反查 ✅

```js
u.forEach(m => {
  const g = At.get(m.from);
  if (g) {
    if (g.type === "gen-image" || g.type === "gen-video") {
      const M = Vt.find(K => K.sourceNodeId === g.id && K.status === "completed");
      if (!M) return;
      // 用任务历史里最近一次成功输出
      const R = M.prompt;
      ...
    }
    if (g.type === "storyboard-node") {
      const M = ((v = g.settings) == null ? void 0 : v.shots) ?? [];
      // 用第一个 shot 的输出
    }
    if (g.type === "input-image" || g.type === "preview") {
      // 直接用 g.content
    }
    if (g.type === "video-input") {
      // 用 g.frames[0]
    }
  }
});
```

**重写**：写成 `resolveUpstream(nodeId)` 钩子，返回 `{ referenceImages, prompt, mask }`。

## 4. 撤销栈实现 ✅

```js
P(t => [...t, { nodes: JSON.parse(JSON.stringify(C)), connections: JSON.parse(JSON.stringify(I)) }].slice(-O))
```

- `P` 是 setUndoStack，`O = tapnow_max_undo_steps`
- 深拷贝用的是 `JSON.parse(JSON.stringify(...))`（不处理 Date / Map / Function）
- redo 栈是另一个数组 `A`

**重写**：用 zundo 中间件 + immer，比手写更稳，原版的 deep-clone 性能在大画布会卡。

## 5. 自动保存 ✅

```js
_.useEffect(() => {
  const t = setInterval(() => {
    (async () => {
      const a = Date.now();
      const d = { nodes: await ip(ti.current), connections: _d.current, timestamp: a };
      const p = JSON.stringify(d);
      try {
        await E2(p);            // E2 = idb-keyval set
        j.current = true;
        Vp({ timestamp: a, storage: 'idb' });
        try { localStorage.setItem(...) } catch {}
      } catch {}
    })();
  }, ???);
}, []);
```

- `E2` = idb-keyval 的 set 函数
- `ip(nodes)` 看名字像 "intern preview"，可能是把大图换成 assetId
- 频率推测：2-5 秒一次（无法精确确认）

**重写**：用 store.subscribe + debounce(1500ms)，不用 setInterval。

## 6. 模型分支判断核心条件 ✅

```js
const wp = (z.includes("banana") || z.includes("edit") || z.includes("qwen"))
        && !(z.includes("nano-banana-2") || ((Ke == null ? void 0 : Ke.modelName) ?? "").includes("nano-banana-2"));
const zp = z.includes("gpt") || ((Ke == null ? void 0 : Ke.modelName) ?? "").includes("gpt-image")
        || ((Ke == null ? void 0 : Ke.provider) ?? "").toLowerCase() === "...";
```

- `z` = 小写后的模型名
- `Ke` = 模型库里查出来的 ModelDef
- `wp` 为真 → 走 `/v1/images/edits` 同步
- 含 `nano-banana-2` → 单独走 async

**重写**：抽到 `routeRequest()`，不再用 includes 拼条件，改用 ModelDef 的 `provider` + `supportsEdit` + `async` 字段，更稳。

## 7. 模板替换正则 🟡

观察到模板形如 `{{prompt}}`、`{{duration:number}}`、`{{image:blob}}`，没有抓到原版替换实现，按上下文推断：

```js
// 推测的解析正则
/\{\{\s*([a-zA-Z0-9_.]+)(?::([a-zA-Z0-9_-]+))?\s*\}\}/g
```

**重写**：自写 `src/api/template.ts`，单元测试覆盖：
- 简单字符串替换
- `:number` → parseInt
- `:blob` → FormData append + 整个请求改成 multipart
- 找不到变量 → 抛 `TemplateMissingError`

## 8. Sora prompt 改写 ✅

```js
t = t.replace(/@([a-zA-Z0-9_.]+)(?![a-zA-Z0-9_.])/g, (pe, er) => `@{${er}}`)
```

含义：`@alice` → `@{alice}`，但 `@{alice}` 已经是目标形，不再改写（lookahead 阻止）。
**重写**：保留同样语义。

## 9. Jimeng 强制本地文件 ✅

```js
// 文案：即梦模型的图生图功能将强制使用本地文件（FormData），URL图片会自动下载转换为本地文件
const Ie = g.map(Et => ss(Et, { useProxy: xi(Et) }));
// ss 看起来是 "stringStream" → fetch URL → Blob
```

**重写**：`api/utils/blobifyIfRemote(url)`，传入 dataURL / http URL，返回 Blob。
- dataURL 直接 atob
- http(s) 用 fetch + 可选代理（用户自己配的 corsProxy）

## 10. 多模型 + customParams ✅

```js
const M = d.customParams || ((qt = y?.settings)?.customParams) || null;
const R = Ht(z);  // z = modelId，Ht = lookup ModelDef
const K = by(R || {}).find(pe => pe.level === "error");
if (K) throw new Error(`[配置校验阻断] ${K.message}`);
```

`by(modelDef)` 看起来是返回 `customParams` 的校验结果数组。
**重写**：每个 ModelDef 可以挂一个 `validate(settings): ValidationIssue[]`，UI 在生成前显示阻断错误。

## 11. 节点 ID 与撤销栈非耦合 ✅

撤销栈 push 时整个 nodes / connections 都序列化进去，节点 ID 保持不变（不重新生成），所以撤销不会破坏 connection 引用。

## 12. 队列状态结构 🟠

未直接抓到 `GenerationTask` 的完整定义，但根据 `Vt.find(K => K.sourceNodeId === g.id && K.status === "completed")` 推测：

```ts
interface GenerationTaskHistory {
  id: string;
  sourceNodeId: NodeId;
  status: 'generating' | 'completed' | 'failed';
  prompt?: string;
  url?: string;
  originalUrl?: string;
  // Midjourney 专属
  mjImages?: string[];
  mjOriginalUrl?: string;
  type?: 'image' | 'video';
}
```

**重写**：store/tasks.ts 严格定义 + 持久化到 IDB `tasks` 表。

## 13. 不确定 / 未在 HTML 中找到证据的部分

| 项目 | 信心 | 说明 |
|---|---|---|
| 异步轮询的退避策略具体值 | 🟠 | 抓到 `requestId` 模板但没看到轮询循环 |
| Midjourney 切图算法 | 🟠 | 只看到 `mjImages` 字段，没看到 canvas 切割代码 |
| 蒙版预处理 f5 的算法（缩放？灰度？） | 🟠 | 只看到 "蒙版处理失败" 提示 |
| 角色 / 场景库的 schema | 🟠 | `tapnow_characters` 存在但没看到读写代码 |
| storyboard 的 LLM prompt slot 用法 | 🟠 | 字段名抓到但语义不明 |

**重写策略**：上面这些先按合理默认值实现，后续遇到具体 case 再回头校准。

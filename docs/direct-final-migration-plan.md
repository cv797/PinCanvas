# 成图直出迁移方案

## 调研结论

`flow/src/modules/direct-final` 不是一个单独页面功能，而是一条完整的电商成图链路。它包含商业输入、必卖理由门禁、主图与详情脚本、成图执行、脚本自审、结果复盘等层次。

PinCanvas 的基础更适合画布节点化迁移。它已经有 `input-image`、`gen-image`、`chat`、`preview`、`image-compare`、上游反查、任务队列和 IDB 持久化，所以不建议照搬 `flow` 的 Next.js 页面、文件 JSON 存储和 Flow executor。

建议迁移 `direct-final` 的数据结构、prompt 策略、主图/详情模块定义、合规校验和复盘评分维度，把它们改成 PinCanvas 的节点与画布模板。所有流程模块都做成节点，不用开关隐藏步骤；每一步的生成结果都要成为可连线、可复盘、可重跑的节点。

## flow 中可复用的部分

- `types.ts`：CommercialBrief、SellingReasonCard、DirectFinalArtifact、DirectFinalAsset、Review 等结构。
- `service.ts`：商业输入与必卖理由的 prompt 规则、缺失字段检测、过期检测思路。
- `artifact.ts`：5 张主图、M1-M8 详情模块、成图脚本结构、执行 prompt 拼装。
- `review.ts`：出图后复盘维度，包括文字渲染、可读性、目标对齐、合规保留、成品感、商品保真。
- `self-review.ts` 与 `compliance/*`：出图前脚本校验和品类合规硬规则。

## 不建议照搬的部分

- `app/page-neo.tsx` 和 direct-final 页面布局：PinCanvas 应该用节点组件表达流程。
- `serialization.ts` 的项目文件 JSON 存储：PinCanvas 已经用节点 settings + IDB 快照。
- Flow executor 浏览器自动化：PinCanvas 已有 OpenAI 兼容图片生成链路。
- projectId/runId/outputId 那套后端实体：PinCanvas 可以用 nodeId、taskId 和节点 settings 记录状态。

## 推荐节点流程

推荐默认模板如下：

```text
direct-final-upload 上传源图
  -> direct-final-analysis 商业分析
  -> direct-final-gate 门禁节点 × N
  -> direct-final-main-prompt 主图 prompt 节点 × N
  -> direct-final-render 生图节点
  -> direct-final-review 复盘节点

每个门禁节点也可以生成：
  -> direct-final-detail-prompt 详情图 prompt 节点 × N
  -> direct-final-render 生图节点
  -> direct-final-review 复盘节点
```

### 1. 上传节点

新增 `direct-final-upload` 节点，也可以在实现上复用现有 `input-image` 的上传、预览、拖拽和上游输出能力。这个节点负责承载商品源图，一张或多张都通过连线传给后续节点。

源图节点必须能继续连到分析、prompt 和生图节点。成图时仍然需要直接引用源图，避免商品外观、包装文字、logo 和认证标识漂移。

### 2. 商业分析节点

新增 `direct-final-analysis` 节点，输入上传节点，输出 CommercialBrief。节点内提供 AI 生成、人工编辑、确认保存、缺失字段提示和源图变化提示。

它相当于 flow 的“商业输入草稿”。字段建议保留：商品类型、品牌名、公司名、SKU、价格、主图文案初稿、目标人群、竞品线索、市场备注、缺失字段。

分析节点还负责生成门禁节点。用户可以选择生成全部门禁，也可以勾选具体方向后只生成部分门禁。生成动作会在画布上创建多个 `direct-final-gate` 节点，并自动从分析节点连线过去。

### 3. 门禁节点

新增 `direct-final-gate` 节点。每个门禁节点就是一个步骤节点，存一张 SellingReasonCard：目标人群、痛点、解决方案、利益翻译、信任证据、优先级、场景偏好、适用模块、确认状态。

门禁节点不是列表项，也不是面板里的选项，而是画布上的独立节点。一个商业分析可以生成 3-8 个门禁节点；有几个门禁，就生成几个门禁节点。

单个门禁节点可以继续生成下游 prompt 节点。用户在门禁节点内选择生成数量和类型：主图 prompt、详情图 prompt，或两者都生成。生成后自动创建对应数量的 prompt 节点，并从该门禁节点连线过去。

### 4. 主图 prompt 节点

新增 `direct-final-main-prompt` 节点。它输入一个或多个门禁节点、商业分析节点和源图节点，输出一张主图的 DirectFinalAsset 脚本。

主图 prompt 节点不需要固定一次创建 5 个。默认模板可以生成 5 个主图方向，但也允许某个门禁节点单独生成 1-5 个主图 prompt 节点。

主图方向沿用 flow 的目标：

| slot | 目标 |
|---|---|
| 1 | 首图点击率核心 |
| 2 | 痛点共鸣 |
| 3 | 差异化优势 |
| 4 | 场景适配 |
| 5 | CTA 行动号召 |

脚本字段保留 goal、visualContent、inImageCopy、textBlocks、layoutHints、layerPlan、designNotes、negativeConstraints、complianceNotes、originSellingReasonIds。

### 5. 详情图 prompt 节点

新增 `direct-final-detail-prompt` 节点。它输入一个或多个门禁节点、商业分析节点和源图节点，输出一张详情图的 DirectFinalAsset 脚本。

详情图模块不做隐藏式配置。需要 M1-M8 中哪几个，就生成哪几个详情图 prompt 节点。默认模板可以生成 M1、M2、M3、M4、M6、M7；门禁节点也可以按用户选择生成任意数量的详情图 prompt 节点。

| code | 目标 |
|---|---|
| M1 | 首屏痛点共鸣 |
| M2 | 核心优势展开 |
| M3 | 配方/工艺深度 |
| M4 | 使用场景 |
| M5 | 品牌/资质信任 |
| M6 | 规格参数 + 竞品对比 |
| M7 | FAQ |
| M8 | 购买引导 + 法律声明 |

详情图 prompt 节点默认画幅建议使用 3:4 或 4:5。

### 6. 生图节点

新增 `direct-final-render` 节点，输入一个主图 prompt 或详情图 prompt，同时输入源图。它负责把 DirectFinalAsset 拼成最终图片 prompt，再调用现有图片生成链路。

这里不建议直接复用普通 `gen-image` 作为唯一生图节点，因为 direct-final 需要固定保留商品包装、图内文字、合规备注、负面约束和脚本来源。普通 `gen-image` 更适合自由 prompt。

### 7. 复盘节点

新增 `direct-final-review` 节点，输入结果图、源图和对应 prompt 节点，输出复盘分数与修改建议。评分维度沿用 flow：文字渲染、文案可读、目标对齐、合规保留、成品感、商品保真。

复盘节点可以把修改建议连回主图 prompt 或详情图 prompt，用于下一版脚本重写。第一版可以先做人工复盘和 AI 复盘，自动重写放到后续。

## 实现顺序

### M1：节点与数据结构

新增 direct-final 类型定义，先把状态放在节点 settings 中。新增节点：

- `direct-final-upload`
- `direct-final-analysis`
- `direct-final-gate`
- `direct-final-main-prompt`
- `direct-final-detail-prompt`
- `direct-final-render`
- `direct-final-review`

同时更新 `src/types/node.ts`、`src/canvas/factory.ts`、`src/canvas/Canvas.tsx`、`src/components/AddNodeMenu.tsx`、`src/config/features.ts`。

### M2：节点生成节点

分析节点负责生成门禁节点。它可以生成全部门禁，也可以按用户选择生成部分门禁。

门禁节点负责生成主图 prompt 节点和详情图 prompt 节点。单个门禁节点内要提供数量和类型选择，例如生成 3 个主图 prompt、生成 2 个详情图 prompt，或按 M1-M8 选择生成详情图 prompt。

所有生成动作都应该在画布上创建真实节点并自动连线，不把结果塞进隐藏列表。

### M3：结构化 LLM 能力

新增 `src/api/structured.ts`，在现有 OpenAI 兼容 chat 调用基础上支持结构化 JSON。实现前需要确认目标网关支持的 JSON schema 参数形状；不同网关可能只支持普通 JSON 文本约束。

商业分析、门禁节点、主图 prompt、详情图 prompt、复盘都通过这个能力生成结构化结果。

### M4：生图执行

`direct-final-render` 复用 `generateImage`，但 prompt 由主图 prompt 节点或详情图 prompt 节点构造，不让用户手写散乱 prompt。它应该同时读取源图、prompt 节点、画幅和模型设置。

输出仍写入当前节点 `content/generatedImages`，这样可以继续接到 `preview`、`image-compare` 或 `direct-final-review`。

### M5：一键模板

新增“电商成图直出模板”，一次创建上传节点、分析节点、生图节点和复盘节点。门禁节点和 prompt 节点可以先由用户在分析节点、门禁节点上生成，也可以由模板按默认数量一起创建。

默认模板建议创建：1 个上传节点、1 个分析节点、5 个门禁节点、5 个主图 prompt 节点、6 个详情图 prompt 节点、若干生图节点和复盘节点。所有节点都要落在画布上并自动连线。

### M6：增强能力

- 出图前 self-review 作为 prompt 节点或生图节点的校验动作。
- 复盘后自动重写 prompt 节点。
- 批量生图队列。
- 风险确认与证据记录。

## 和原设想的差异

你的流程是：上传节点 -> 分析节点 -> 门禁节点 -> 主图/详情图 prompt 节点 -> 生图节点 -> 复盘节点。

这次方案按这个方向调整：所有中间产物都成为画布节点。不再做开关，不再做隐藏模块，也不再用 `direct-final-gate-splitter` 包住门禁列表。

分析节点生成门禁节点；门禁节点生成主图 prompt 节点或详情图 prompt 节点。门禁有几个，就在画布上生成几个节点。某个门禁要生成多少主图或详情图，也由这个门禁节点自己决定。

## 必须保留的硬规则

- 商业分析未确认，不能生成门禁节点。
- 门禁节点未确认，不能生成主图 prompt 或详情图 prompt。
- 主图 prompt 可以沿用 5 个目标：点击率、痛点、差异化、场景、CTA，但这些目标要落成独立节点。
- 详情图 prompt 可以沿用 M1-M8，但需要哪个模块就生成哪个节点，不做隐藏开关。
- 图内文案必须少而准，不能编造源图看不清的品牌、认证、规格和功效。
- 普通食品不能写功效；保健类不能写疾病或治疗；运动器材不能医疗化；所有品类都不要绝对化。
- 生图节点必须连源图和对应 prompt 节点，避免商品外观、包装文字、logo 和认证标识漂移。

## 推荐第一版范围

推荐先做 M1-M5，不做 self-review 和复盘自动重写。第一版目标是：

1. 能一键铺设电商成图直出模板。
2. 能从上传节点生成商业分析。
3. 能从分析节点生成并确认 3-8 个门禁节点。
4. 能从单个门禁节点按数量生成主图 prompt 或详情图 prompt 节点。
5. 能用 prompt 节点和源图生成最终图。
6. 能对结果图做复盘打分。

这样能先形成完整可见的节点流程，同时避开 flow 原项目里最重的文件存储、执行器证据链和浏览器自动化。

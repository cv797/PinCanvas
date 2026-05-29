# 更新日志

本文件记录 PinCanvas 项目的所有重要变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.0.1] - 2026-05-28

### 新增

- **图片生成节点：@ 引用上游参考图** — 在图像生成节点的 prompt 编辑器中可输入 `@` 唤起参考图选择器，从已连接的图片节点中选择参考图并以卡片形式插入到提示词中（`图片1`、`图片2` …）。所支持的上游来源：
  - `input-image`（已上传内容）
  - `gen-image`（已生成结果）
  - `image-compare`（已存在图片）
  - `preview`（图片类型，含已缓存内容）
- **画布连接类型校验** — 拖线建立连接时校验目标节点的可接入类型；图片生成节点（`gen-image`）仅接受图片源节点的连入，避免误连产生无效引用。

### 截图

- `docs/images/mention-references.png` — @ 引用参考图工作流示例
- `docs/images/text-to-video.png` — 文本驱动视频生成的简单链路

[0.0.1]: https://github.com/tdsoc2002/PinCanvas/releases/tag/v0.0.1

# 安全策略

## 报告漏洞

如果你发现了 PinCanvas 的安全漏洞，请**不要**在公开的 Issue 中报告。

请通过以下方式私下联系维护者：

* **GitHub Security Advisory**: [Report a vulnerability](https://github.com/tdsoc2002/PinCanvas/security/advisories/new)（推荐）

* **邮箱**: 在 GitHub Profile 中查看维护者联系方式

请在报告中包含：

1. 漏洞描述与影响范围

2. 复现步骤（最好附带 PoC）

3. 受影响的版本

4. 你期望的修复方式或建议

我们会在 **5 个工作日内**响应。修复发布后会在 Release Notes 中致谢报告者（除非你要求匿名）。

## 安全最佳实践

使用 PinCanvas 时请遵循以下安全建议：

### API Key 管理

⚠️ **API Key 是敏感凭证，泄露会导致账单损失或滥用**

* ❌ **不要**把 API Key 提交到 git 仓库

* ❌ **不要**在公共聊天/截图中暴露 API Key

* ❌ **不要**通过 URL 参数传递 API Key（会被浏览器历史、CDN、Referer 头泄露）

* ✅ **推荐**在「设置面板」手动输入 Key，仅保存在本地浏览器

* ✅ **推荐**为不同环境使用不同的 Key，便于隔离吊销

### 本地化数据

* PinCanvas 默认把项目数据保存在浏览器 IndexedDB

* 清除浏览器数据会**永久丢失**画布数据，请定期导出备份

* 在他人电脑/共用环境使用后，记得清除 localStorage 与 IndexedDB

### 自托管部署

* 部署时务必填写 `STORAGE_NAMESPACE_SALT` 为随机字符串

* 不要使用 `.env.example` 中的占位值作为生产配置

* 对象存储凭证应使用最小权限的子账号

* 部署后检查 `/api/storage/status` 端点是否暴露了不必要信息

### 第三方模型

* 第三方 AI 服务的内容生成由该服务负责审核

* 上传素材前请确认你拥有合法版权或授权

* 注意各服务的内容政策与商用条款

## 已知的设计限制

* **URL 凭证导入**: `src/store/urlRuntimeConfig.ts` 支持通过 URL 注入 API Key，便于受信任环境的快速登录。**仅推荐在同源 SSO 场景使用**，不要让此 URL 进入公共渠道。

* **客户端密钥**: 由于是纯前端应用，API Key 存储在浏览器 localStorage，无法防御本地恶意脚本。如需更高安全级别，建议使用服务端代理。

## 支持的版本

| 版本        | 安全更新      |
| --------- | --------- |
| `main` 分支 | ✅ 持续维护    |
| 旧版本       | ❌ 请升级到最新版 |

## 致谢

感谢所有负责任披露漏洞、帮助提升 PinCanvas 安全性的贡献者。

⠀
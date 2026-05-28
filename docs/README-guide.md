# README 使用说明

本项目维护两个版本的 README：

## 文件说明

- **README.md** - 公开版本（用于 GitHub 等公开仓库）
- **README.internal.md** - 内部版本（包含内部信息、部署说明等）

## 使用方法

### 推送到内部仓库

```bash
# 1. 使用内部版 README
cp README.internal.md README.md

# 2. 提交并推送
git add README.md
git commit -m "docs: update README"
git push origin main
```

### 推送到公开仓库

```bash
# 1. 确保 README.md 是公开版本（默认就是）
# 如果之前切换过，需要恢复：
git checkout README.md

# 2. 推送到公开仓库
git push public main
```

## 注意事项

1. **默认状态**：`README.md` 保持为公开版本
2. **内部开发**：需要内部信息时查看 `README.internal.md`
3. **切换前检查**：推送前确认使用了正确的 README 版本
4. **不要提交切换**：如果临时切换了 README，记得恢复后再提交

## 快速切换脚本（可选）

可以创建以下脚本简化切换：

```bash
# scripts/use-internal-readme.sh
cp README.internal.md README.md
echo "✅ 已切换到内部版 README"

# scripts/use-public-readme.sh  
git checkout README.md
echo "✅ 已恢复公开版 README"
```

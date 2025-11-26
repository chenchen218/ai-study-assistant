# 如何将测试文档转换为Word/PDF

## 方法1: 使用在线工具（最简单）

### 步骤：
1. 打开在线Markdown转Word工具：
   - https://www.markdowntoword.com/
   - https://dillinger.io/ (导出为HTML，然后导入Word)
   - https://www.zamzar.com/convert/md-to-docx/

2. 上传 `TESTING_DOCUMENTATION.md` 文件
3. 下载转换后的 `.docx` 文件
4. 在Word中打开，调整格式
5. 在Word中：文件 → 另存为 → PDF

## 方法2: 使用Pandoc（推荐，格式最好）

### 安装Pandoc：
```bash
# macOS
brew install pandoc

# Windows
# 下载安装包：https://pandoc.org/installing.html
```

### 转换命令：
```bash
# 转换为Word
pandoc TESTING_DOCUMENTATION.md -o TESTING_DOCUMENTATION.docx

# 直接转换为PDF（需要LaTeX）
pandoc TESTING_DOCUMENTATION.md -o TESTING_DOCUMENTATION.pdf
```

## 方法3: 复制粘贴到Word（快速但需要手动调整）

1. 打开 `TESTING_DOCUMENTATION.md` 文件
2. 全选复制（Cmd+A, Cmd+C / Ctrl+A, Ctrl+C）
3. 打开Microsoft Word
4. 粘贴（Cmd+V / Ctrl+V）
5. Word会自动识别Markdown格式
6. 手动调整标题样式、表格格式等
7. 另存为PDF

## 方法4: 使用VS Code插件

1. 在VS Code中安装 "Markdown PDF" 插件
2. 打开 `TESTING_DOCUMENTATION.md`
3. 右键 → "Markdown PDF: Export (pdf)"
4. 或者导出为HTML，然后导入Word

## 推荐流程

**最简单快速**：方法1（在线工具）
**格式最好**：方法2（Pandoc）
**需要精细调整**：方法3（复制粘贴）


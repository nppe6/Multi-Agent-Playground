---
name: mastergo-to-code
description: 从 MasterGo 设计稿生成代码，自动处理图片资源（小图本地存储，大图上传 OSS）。当用户提到 MasterGo 设计稿、切图、设计转代码、从设计稿生成组件、处理设计资源时，必须使用此 skill。即使用户只说"帮我把设计稿转成代码"或"处理一下这个 MasterGo 链接"也要触发。
---

## mastergo-to-code（MasterGo 设计稿转代码）

### 🟢 触发场景 (When to use)

- 用户提供 MasterGo 设计稿链接（fileId + layerId 或 shortLink），需要生成代码时。
- 需要从设计稿中提取图片资源，将大图上传到 OSS CDN，小图保留本地时。
- 用户说"帮我切图"、"把这个设计转成 Vue/React 代码"、"处理 MasterGo 设计稿"等场景。

### 📝 功能描述

该 Skill 负责**从 MasterGo 设计稿提取资源并生成代码**：

1.  **获取设计 DSL**：使用 `mcp__mastergo-magic-mcp__mcp__getDsl` 工具获取设计稿结构数据。
2.  **获取组件文档**：若 DSL 中包含 `componentDocumentLinks`，使用 `mcp__mastergo-magic-mcp__mcp__getComponentLink` 逐一获取组件文档。
3.  **提取图片资源**：从 DSL 的 `styles` 对象中解析出所有图片 URL（`paint_*` 开头的 key，其 value 中包含 `url` 字段的条目）。
4.  **下载图片到本地临时目录**：将图片下载到 `temp-mastergo/` 目录。
5.  **智能分类**：根据文件大小（默认 50KB 阈值）自动判断：
    - **小图 (< 50KB)**：复制到项目 `src/static/images/` 目录。
    - **大图 (≥ 50KB)**：上传至阿里云 OSS，获取 CDN 链接。
6.  **生成代码**：根据 DSL 结构和图片映射表，生成 Vue/React 组件代码。
7.  **输出映射表**：返回 JSON 格式的路径映射，供生成代码时使用。

**核心优势**：解决小程序 2MB 包体积限制，自动化 OSS 上传流程，直接从 MasterGo 设计稿生成可用代码。

### ⚙️ 调用签名 (Signature)

#### Step 1: 获取设计 DSL

使用 MasterGo MCP 工具获取设计数据：

```
// 方式一：通过 shortLink（仅限 goto 短链接）
mcp__mastergo-magic-mcp__mcp__getDsl({ shortLink: "https://mastergo.com/goto/XxxXxx" })

// 方式二：通过 fileId + layerId（推荐，从完整 URL 中提取）
mcp__mastergo-magic-mcp__mcp__getDsl({ fileId: "123456", layerId: "789" })
```

**URL 解析规则**：

- 完整 URL 格式：`https://mastergo.com/file/<fileId>?page_id=xxx&layer_id=<layerId>`
- `fileId`：从路径 `/file/<fileId>` 中提取数字部分
- `layerId`：**仅从 `layer_id` 参数提取**，需 URL decode（如 `376%3A31361` → `376:31361`）
- `page_id` **不是** layerId，不要混淆
- **完整 URL 不能作为 shortLink 传入**，shortLink 仅接受 `https://mastergo.com/goto/xxx` 格式
- 如果用户给的是完整 URL，必须解析出 fileId + layerId 后用方式二调用

**⚠️ DSL 结果通常非常大（200K-300K+ 字符），会超出 token 限制被存为本地文件。** 处理策略见下方「DSL 大文件解析策略」。

#### Step 1.1: DSL 大文件解析策略

getDsl 返回的 DSL 通常超过 25K token 限制，会被自动存为 `.txt` 文件。**不要用 Read 工具读取此文件**（文件只有几行，每行是巨大 JSON blob，Read 的 limit 参数按行数计算，无法有效截取）。

**正确做法：使用 `node -e` 解析 JSON 结构**：

```bash
# Step 1: 获取顶层结构
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('<saved_file_path>', 'utf-8'));
const parsed = JSON.parse(data[0].text);
console.log('Top-level keys:', Object.keys(parsed));
if (parsed.rules) console.log('Rules:', JSON.stringify(parsed.rules).substring(0, 3000));
if (parsed.componentDocumentLinks) console.log('Links:', JSON.stringify(parsed.componentDocumentLinks));
"

# Step 2: 获取 DSL 节点树概览（depth 2）
node -e "
const fs = require('fs');
const parsed = JSON.parse(JSON.parse(fs.readFileSync('<saved_file_path>', 'utf-8'))[0].text);
const root = parsed.dsl.nodes[0];
function printTree(node, depth) {
  const indent = '  '.repeat(depth);
  const size = node.layoutStyle ? ' w=' + node.layoutStyle.width + ' h=' + node.layoutStyle.height : '';
  console.log(indent + node.type + ' name=\"' + (node.name || '') + '\"' + size + ' children=' + (node.children ? node.children.length : 0));
  if (node.children && depth < 2) node.children.forEach(c => printTree(c, depth + 1));
}
printTree(root, 0);
"

# Step 3: 深入目标子树（根据用户需求定位）
# 根据 Step 2 的输出，找到目标容器组名称，然后深入解析
node -e "
const fs = require('fs');
const parsed = JSON.parse(JSON.parse(fs.readFileSync('<saved_file_path>', 'utf-8'))[0].text);
const root = parsed.dsl.nodes[0];
const target = root.children.find(c => c.name === '目标容器名');
// ... 继续深入解析
"
```

**关键注意事项**：

- **必须用 Node.js**，不要用 Python（Windows 环境下 Python 可能不可用）
- DSL 结构为 `{ dsl: { styles, nodes, components }, componentDocumentLinks, rules }`
- `nodes` 是数组，通常只有 1 个根节点，通过 `children` 递归嵌套
- 先获取树概览（depth 2），再根据用户需求定位到目标子树深入解析，避免一次性输出全部内容

#### Step 1.2: 定位目标内容区域

getDsl 返回的是整个 layerId 对应的完整设计稿，通常包含 banner、header、footer、背景等与用户需求无关的区域。

**当用户只需要某个特定区域（如某个 tab 内容）时**：

1. 先用 depth 2 的树概览找到顶层容器结构
2. 根据容器 `name` 字段定位到目标区域（如 `name="内容"`、`name="标题"` 等）
3. 只对目标子树做深度解析，忽略 banner/footer/背景等无关区域
4. 生成代码时也只针对目标区域，不要生成整个页面

#### Step 1.3: 提取图片 URL

图片资源存储在 DSL 的 `styles` 对象中：

```bash
node -e "
const fs = require('fs');
const parsed = JSON.parse(JSON.parse(fs.readFileSync('<saved_file_path>', 'utf-8'))[0].text);
const styles = parsed.dsl.styles;
const imageStyles = {};
for (const [key, val] of Object.entries(styles)) {
  if (key.startsWith('paint_') && Array.isArray(val.value)) {
    val.value.forEach(v => {
      if (v && typeof v === 'object' && v.url) {
        imageStyles[key] = v.url;
      }
    });
  }
}
console.log(JSON.stringify(imageStyles, null, 2));
"
```

- 图片以 `paint_*` 为 key，value 数组中包含 `{ url, filters }` 对象的条目即为图片
- 纯色值（如 `#FFFFFF`）和渐变值（如 `linear-gradient(...)`）不是图片，跳过
- 节点通过 `fill` 字段引用 style key（如 `fill="paint_388:30198"`），据此建立节点与图片的映射关系

#### Step 2: 获取组件文档（如有）

```
// 遍历 DSL 中的 componentDocumentLinks
mcp__mastergo-magic-mcp__mcp__getComponentLink({ url: "<componentDocumentLink>" })
```

#### Step 3: 处理图片资源

**执行方式**: Terminal Command
**命令模板**: `npx tsx .claude/skills/mastergo-to-code/index.ts <imagePath> [options]`

**参数说明**:

- `imagePath`: 本地图片路径，支持：
  - 单个文件: `temp-mastergo/bg.png`
  - 目录: `temp-mastergo/`
- `--threshold`: 大小阈值（KB），默认 50
- `--localDir`: 本地目标目录，默认 `src/static/images`

### 🌰 例子 (Example)

#### 示例 1: 从 MasterGo 完整 URL 生成代码

**User**: "帮我把这个 MasterGo 设计稿转成 Vue 代码 https://mastergo.com/file/165825013285546?page_id=286%3A12661&layer_id=376%3A31361"

**Agent Action**:

1.  解析 URL：`fileId = "165825013285546"`, `layerId = "376:31361"`（注意 URL decode）
2.  调用 `mcp__mastergo-magic-mcp__mcp__getDsl({ fileId: "165825013285546", layerId: "376:31361" })`
3.  DSL 结果超大被存为文件 → 用 `node -e` 解析顶层结构和节点树
4.  定位目标内容区域，提取图片 URL
5.  下载图片到 `temp-mastergo/` 目录
6.  Run: `npx tsx .claude/skills/mastergo-to-code/index.ts temp-mastergo/`
7.  读取输出的 JSON 映射表
8.  根据 DSL 结构和映射表生成 Vue 组件代码
9.  清理临时目录 `temp-mastergo/`

#### 示例 2: 从 shortLink 生成代码

**User**: "帮我把这个设计稿转成代码 https://mastergo.com/goto/AbCdEf"

**Agent Action**:

1.  调用 `mcp__mastergo-magic-mcp__mcp__getDsl({ shortLink: "https://mastergo.com/goto/AbCdEf" })`
2.  后续步骤同示例 1 的 Step 3-9

#### 示例 3: 自定义阈值

**User**: "这次所有大于 100KB 的图都上传 OSS"

**Agent Action**:

1.  获取 DSL 并下载图片到本地
2.  Run: `npx tsx .claude/skills/mastergo-to-code/index.ts temp-mastergo/ --threshold 100`
3.  使用返回的映射表生成代码

#### 示例 4: 只需要页面中某个区域

**User**: "帮我实现 tabs 中的'较温合金开发'内容"

**Agent Action**:

1.  获取 DSL 并解析节点树概览
2.  从树中定位到"内容"容器组 → 找到"标题"中的 tab 结构和"联系信息"中的内容区域
3.  只对目标子树做深度解析，忽略 banner/footer/背景
4.  仅生成该 tab 对应的组件代码

### 📋 输出格式

Skill 执行后会输出 JSON 格式的图片映射表：

```json
{
  "localImages": [
    {
      "fileName": "icon-user.png",
      "path": "src/static/images/icon-user.png",
      "size": "12.5 KB"
    }
  ],
  "ossImages": [
    {
      "fileName": "bg-hero.png",
      "cdnUrl": "https://cdn.example.com/mastergo-assets/1770107006562-bg-hero.png",
      "size": "223.75 KB"
    }
  ]
}
```

**Agent 需要根据此映射表在生成的代码中使用正确的路径**。

### ⚠️ 注意事项

- **前置条件**：需要 MasterGo 设计稿的访问权限（shortLink 或 fileId+layerId）。
- **MCP 工具**：必须通过 `mastergo-magic-mcp` MCP 获取 DSL，不要手动构造请求。
- **环境变量**：OSS 配置已在项目中配置完成，Skill 会自动读取。
- **路径引用规则**：
  - 本地图片: 使用相对路径 `../../static/images/xxx.png`
  - CDN 图片: 使用完整 URL `https://...`
- **自动清理**：Skill 不会删除原始图片，Agent 需要在使用后手动清理 `temp-mastergo/` 临时目录。
- **DSL 规则**：`mcp__getDsl` 返回的数据中包含代码生成规则（rules 字段），生成代码时必须遵守这些规则。
- **DSL 解析必须用 Node.js**：Windows 环境下 Python 可能不可用，统一使用 `node -e` 解析 JSON。
- **不要用 Read 工具读取 DSL 存储文件**：文件每行是完整 JSON，Read 的 limit 按行数计算无法有效截取，会反复失败浪费轮次。
- **按需解析，逐步深入**：先获取树概览（depth 2），再定位目标区域深入解析，避免一次性处理全部 DSL 数据。

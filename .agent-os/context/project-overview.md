# Multi-Agent Playground 项目画像

## 技术栈

- 后端：Python、FastAPI、Pydantic、SQLite、OpenAI SDK、LangGraph、python-dotenv。
- 前端：Vue 3、Vite、Composition API、lucide-vue-next、marked。
- 桌面端：Electron、electron-builder、PyInstaller、Node/npm 运行时打包。

## 顶层结构

- `backend/`：API 服务、运行时网关、SQLite 存储、SkillHub 客户端、LangGraph 工作流。
- `frontend/`：Vue 单页应用，负责 Agent、Workflow、运行区、Graph、Trace、Settings 等界面。
- `desktop/`：Electron 壳与打包脚本，负责启动打包后的后端、注入前端 API 地址并构建桌面应用。
- `backend/skills/`：项目内置或安装后的 skill 包。
- `learning-notes/`：项目学习路线图与后续模块笔记。

## 核心入口

- 后端入口：`backend/app/main.py` 创建 FastAPI 应用，启动时初始化默认数据和模型配置。
- API 路由：`backend/app/routes.py` 暴露设置、skills、agents、workflows、runs、conversations 等接口。
- 前端入口：`frontend/src/main.js` 挂载 Vue 应用；`frontend/src/App.vue` 统一拉取初始数据、管理页面状态与运行态。
- 桌面入口：`desktop/main.cjs` 启动后端可执行文件，等待健康检查后加载前端页面。

## 核心模块

- 数据模型：`backend/app/schemas.py` 定义 Agent、Skill、Workflow、Graph、Trace、Run、Conversation、Settings 等跨前后端契约。
- 数据持久化：`backend/app/store.py` 使用 SQLite 保存 agents、workflows、skills、conversations、messages、app_settings，并负责默认数据种子。
- 运行时网关：`backend/app/runtime.py` 封装模型调用、agent prompt 注入、skill 工具发现与执行、工具运行轨迹。
- 设置桥接：`backend/app/settings_bridge.py` 将 UI 中的模型配置和环境变量写回 `.env` 并刷新运行时配置。
- 工作流实现：`backend/app/workflows/*/workflow.py` 分别实现 single agent、router、planner-executor、supervisor、peer handoff 五类 LangGraph 流程。
- 图适配：`backend/app/workflows/langgraph_adapter.py` 将 LangGraph 编译图转换为前端可渲染的 `WorkflowGraph`。
- API 客户端：`frontend/src/api.js` 集中封装 REST 与 SSE 流式运行接口。
- UI 编排：`frontend/src/App.vue` 是前端状态枢纽，向页面和组件分发数据与事件。
- 可视化运行：`frontend/src/components/GraphViewer.vue` 渲染图和活动边；`TraceViewer.vue` 渲染运行事件；`ChatRunner.vue` 发起运行。
- 桌面打包：`desktop/scripts/prepare-artifacts.mjs` 构建前端、打包后端、复制 Node/npm 运行时。

## 关键约定

- 前端没有使用 Vue Router，而是由 `App.vue` 的 `currentPage` 控制页面切换。
- 前端没有使用 Pinia，核心状态集中在 `App.vue`，子组件通过 props/emits 通信。
- 后端的 `WorkflowDefinition.type` 与 `backend/app/workflows/` 下实现一一对应。
- 运行结果通过 `TraceEvent` 串联后端工作流、前端图高亮和 Trace 面板。
- 桌面端通过 `globalThis.__AGENT_PLAYGROUND_CONFIG__` 注入 API base URL，前端 `api.js` 会优先读取它。

## 主要风险

- 部分中文字符串在源码输出中呈现编码异常，学习和后续修复时需要确认文件实际编码与 UI 渲染结果。
- `backend/app/runtime.py` 与 `backend/app/store.py` 较大，职责较多，深入学习时应分专题阅读，避免一次性硬啃。
- 当前仓库未发现自动化测试目录，学习中的实战任务应优先补“字符化/小范围验证”思路。
- 桌面打包依赖本地 Python 虚拟环境、PyInstaller、全局 npm 目录和平台命令，跨平台验证成本较高。

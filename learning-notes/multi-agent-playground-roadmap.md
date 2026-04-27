# Multi-Agent Playground 学习路线图

## 学习目标

读懂这个开源项目如何把“多智能体定义、工作流编排、运行轨迹、可视化 UI、桌面打包”连成一个可运行的 Playground。学完后，你应该能：

- 解释一次用户输入从前端发送到后端、进入 LangGraph 工作流、返回结果和 Trace 的完整链路。
- 区分 5 种工作流的职责边界与适用场景。
- 找到 Agent、Skill、Workflow、Conversation、Settings 的数据落点。
- 在不破坏架构的前提下，设计一个小型扩展任务，例如新增一个工作流类型、改进 Trace 显示或补一个设置项。
- 最终能用 **NestJS + Vue** 重新实现一个类似项目：支持 Agent 管理、Workflow 编排、流式运行、Trace 可视化、模型配置和一个可扩展的多智能体运行时。

## 最终实现目标：NestJS + Vue 复刻版

这条学习路线不是只为了“看懂原项目”，而是为了迁移和复刻。原项目使用 FastAPI + LangGraph + Vue + Electron，我们的最终目标是用 NestJS + Vue 实现一个能力相近的版本。

目标版本的建议边界：

- 后端：NestJS，模块拆分为 `agents`、`skills`、`workflows`、`runs`、`conversations`、`settings`、`runtime`。
- 工作流运行时：先不强依赖 LangGraph，优先用 TypeScript 状态机/服务层实现同等控制流；后续可接入 LangGraphJS 或自定义 DAG runner。
- 流式输出：用 Server-Sent Events，对齐当前项目的 `/api/runs/stream` 思路。
- 数据层：可从 SQLite + Prisma/TypeORM 起步，保持 Agent、Workflow、Conversation、Message、Setting 等核心表。
- 前端：继续使用 Vue 3，复用当前项目的交互模型：Agent 管理、Workflow 管理、Run 面板、Graph 面板、Trace 面板、Settings。
- 可观察性：把 `TraceEvent` 作为第一等契约，先保证每次运行都能解释“谁在做、为什么路由、产生了什么结果”。
- 最小验收：能创建 2 个 Agent，创建一个 Router 或 Planner 工作流，发送一次用户请求，看到聊天结果、图高亮和 Trace 列表。

## 假设起点

假设你具备基础的 Python/JavaScript/Vue 阅读能力，并希望把读到的架构迁移到 NestJS + Vue。路线会从产品闭环开始，再进入后端、前端、桌面端和扩展实践；每个关键模块都会保留一条“原项目理解”和一条“NestJS 复刻映射”。

## 鸟瞰图

这个项目可以先理解成“三层一线”：

- 后端是执行核心：FastAPI 提供 API，SQLite 保存配置，LangGraph 执行多智能体工作流，OpenAI SDK 和 skill 工具提供运行能力。
- 前端是观察和操作层：创建 Agent、创建 Workflow、发起运行、查看聊天、图高亮和 Trace。
- 桌面端是封装层：把前端静态资源和后端可执行文件打包成 Electron 应用。
- 贯穿线是运行事件：`WorkflowRunRequest -> WorkflowRunResponse -> TraceEvent -> GraphViewer/TraceViewer`。
- 迁移时可以把它翻译成：`RunDto -> RunResultDto -> TraceEventDto -> Vue Graph/Trace Components`。

## Source Inspection

- Entry points inspected: `README.md`, `backend/app/main.py`, `backend/app/routes.py`, `backend/app/schemas.py`, `backend/app/store.py`, `backend/app/runtime.py`, `backend/app/settings_bridge.py`, `backend/app/workflows/*/workflow.py`, `frontend/src/App.vue`, `frontend/src/api.js`, `frontend/src/components/ChatRunner.vue`, `frontend/src/components/GraphViewer.vue`, `frontend/src/components/TraceViewer.vue`, `desktop/main.cjs`, `desktop/scripts/prepare-artifacts.mjs`.
- Important areas to inspect later: `backend/app/workflows/*/prompts.py`, `frontend/src/style.css`, `backend/skills/*/SKILL.md`, `backend/scripts/bootstrap-runtime.sh`.
- Provisional assumptions: 当前仓库未看到测试目录；部分中文字符串疑似已在源码中 mojibake，需要运行 UI 或进一步检查编码后确认。

## Learning Route

| Chapter | Learner Outcome | Materials / Files | Key Ideas | Review Focus | Practice / Project Point | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1. 产品闭环与启动路径 | 能说清用户如何创建编排并发起一次运行 | `README.md`, `backend/app/main.py`, `frontend/src/App.vue`, `frontend/src/api.js` | 三层架构、API 边界、启动顺序、运行闭环 | 从 UI 操作倒推后端入口 | 画出当前 Run 链路，并翻译成 NestJS Controller/Service 链路 | Planned |
| 2. 数据契约与持久化 | 能解释核心对象和 SQLite 存储关系 | `backend/app/schemas.py`, `backend/app/store.py` | Pydantic schema、CRUD、默认种子、会话消息 | 哪些字段跨前后端共享 | 设计 NestJS DTO + 数据表草图 | Planned |
| 3. LLM 与 Skill 运行时 | 能理解模型调用、skill 注入和工具执行证据 | `backend/app/runtime.py`, `backend/app/skillhub_client.py`, `backend/skills/*` | system prompt 拼装、tool preflight、依赖/环境检查、fallback | 不把工具失败误判为任务完成 | 设计 NestJS `RuntimeService` 和 `SkillRunnerService` 职责 | Planned |
| 4. 五种工作流模型 | 能比较 single、router、planner、supervisor、peer handoff | `backend/app/workflows/*/workflow.py`, `backend/app/workflows/langgraph_adapter.py` | StateGraph、节点、条件边、finalizer、TraceEvent | 每种 workflow 的控制权在哪里 | 用 TypeScript 伪代码描述 Router/Planner 状态机 | Planned |
| 5. 前端状态与交互层 | 能读懂页面状态如何从 App 下发到组件 | `frontend/src/App.vue`, `frontend/src/pages/*`, `frontend/src/components/*` | Composition API、props/emits、localStorage、SSE fallback | 哪些状态是全局的，哪些是组件私有的 | 规划 Vue 复刻版组件树和 API client | Planned |
| 6. 图与 Trace 可视化 | 能解释运行事件如何点亮图、组织 Trace 卡片 | `GraphViewer.vue`, `TraceViewer.vue`, `schemas.py` | graph layout、active node、动态边、Trace 分组 | TraceEvent payload 设计 | 定义 NestJS `TraceEventDto` 并手工构造前端样例 | Planned |
| 7. 设置与运行部署 | 能理解模型配置如何写入环境并被运行时使用 | `settings_bridge.py`, `SettingsPage.vue`, `desktop/main.cjs`, `prepare-artifacts.mjs` | `.env` 写回、运行时刷新、Electron 启动后端、PyInstaller | 本地开发、服务部署、桌面打包的差异 | 设计 NestJS 版配置模块和部署形态清单 | Planned |
| 8. NestJS + Vue 复刻实战 | 能规划并实现最小可运行版本 | 以上模块 + 新项目脚手架 | 模块拆分、契约先行、SSE、Trace、最小工作流 | 是否形成端到端闭环 | Capstone：实现 Router/Planner 二选一的最小多 Agent Playground | Planned |

## Module Explanations And Practice Tasks

### Chapter 1: 产品闭环与启动路径

- Why it matters: 先抓住“用户看到什么、请求去哪、结果怎么回来”，后面读任何模块都有坐标。
- Minimal mental model: 前端负责选择和发送，后端负责执行和存储，Trace 把运行过程重新喂给前端可视化。
- Learn: 服务启动、初始数据加载、API client、SSE 与普通 run fallback。
- Read or inspect: `README.md`, `backend/app/main.py`, `backend/app/routes.py`, `frontend/src/App.vue`, `frontend/src/api.js`。
- Watch for: 不要一开始陷入 LangGraph 细节；先看 `handleRun -> runWorkflowStream -> /api/runs/stream -> _dispatch_run`。
- First walkthrough: 从 `ChatRunner.submit()` 输入一句话，追到 `routes.run_workflow_stream()`，再回到 `App.vue` 更新 `chatMessages` 和 `displayedTrace`。
- Practice: 画一张 8 步以内的运行时序图，标出前端函数、API 路径、后端函数、返回数据。
- NestJS transfer: 把 `routes.run_workflow_stream()` 映射成 `RunsController.stream()`，把 `_dispatch_run()` 映射成 `WorkflowRuntimeService.dispatch()`。
- Review: 不看代码回答：如果 SSE 失败，前端如何保证仍能得到结果？
- Document: `learning-notes/multi-agent-playground-run-loop.md`

### Chapter 2: 数据契约与持久化

- Why it matters: 这个项目的前后端靠 schema 说话，读懂对象就读懂了系统语言。
- Minimal mental model: `schemas.py` 定义“能传什么”，`store.py` 定义“存到哪里”，`routes.py` 负责把二者连起来。
- Learn: Agent、Skill、Workflow、TraceEvent、RunArtifacts、Conversation、AppSettings。
- Read or inspect: `backend/app/schemas.py`, `backend/app/store.py`, `backend/app/routes.py`。
- Watch for: `WorkflowDefinition.type` 必须和工作流分发逻辑一致；`TraceEvent.payload` 是灵活字典，但前端依赖其中若干约定字段。
- Practice: 做一张字段清单：每个核心对象列出“创建 API、存储表、前端使用组件”。
- NestJS transfer: 将 `schemas.py` 中的核心对象拆成 DTO、Entity/Model、前端 TypeScript type 三层，并标出哪些字段必须同名。
- Review: 解释为什么删除 Agent 时要检查它是否仍被非 single-agent workflow 使用。
- Document: `learning-notes/multi-agent-playground-data-contracts.md`

### Chapter 3: LLM 与 Skill 运行时

- Why it matters: 项目真正的“智能体能力”不在 UI 卡片，而在运行时如何组合系统 prompt、模型配置和可执行 skill。
- Minimal mental model: Agent 是配置，LLMGateway 是执行器，Skill 是可注入的能力包。
- Learn: 模型 profile、`run_agent`、tool preflight、依赖检测、失败标记、fallback。
- Read or inspect: `backend/app/runtime.py`, `backend/app/settings_bridge.py`, `backend/app/skillhub_client.py`, `backend/skills/*/SKILL.md`。
- Watch for: 工具执行失败会产生 Trace 和特殊标记，不能把“工具运行过”理解成“任务完成”。
- Practice: 选择一个内置 skill，写出它从安装、绑定 agent、运行、Trace 反馈的生命周期。
- NestJS transfer: 设计 `RuntimeModule`，至少包含 `LlmGatewayService`、`ToolPreflightService`、`SkillRunnerService` 和 `TraceEmitter`。
- Review: 说清 `settings_bridge.py` 为什么既要写 `.env`，又要更新 `os.environ` 并刷新 settings。
- Document: `learning-notes/multi-agent-playground-runtime-skills.md`

### Chapter 4: 五种工作流模型

- Why it matters: 这是项目最核心的学习价值：同样是多智能体，不同控制流代表不同协作哲学。
- Minimal mental model: 每个 workflow 都是一个 LangGraph 状态机，只是“谁决定下一步”不同。
- Learn: single agent、router specialists、planner executor、supervisor dynamic、peer handoff。
- Read or inspect: `backend/app/workflows/single_agent_chat/workflow.py`, `router_specialists/workflow.py`, `planner_executor/workflow.py`, `supervisor_dynamic/workflow.py`, `peer_handoff/workflow.py`, `langgraph_adapter.py`。
- Watch for: `planner_executor` 是先拆任务再派发；`supervisor_dynamic` 是循环审查再决定是否继续；`peer_handoff` 把下一步动作交给 peer 的结构化 JSON 决策。
- Practice: 用同一个需求“生成一个小工具并检查风险”，分别判断 5 种 workflow 中哪 2 种最合适，并说明控制权差异。
- NestJS transfer: 先复刻 `single_agent_chat` 和 `router_specialists`；等端到端跑通后，再实现 `planner_executor`。
- Review: 不看代码画出 `planner_executor` 的节点顺序。
- Document: `learning-notes/multi-agent-playground-workflows.md`

### Chapter 5: 前端状态与交互层

- Why it matters: 前端是用户理解多智能体系统的窗口，它把复杂状态压成可操作的页面。
- Minimal mental model: `App.vue` 是状态枢纽，页面组件是组合层，具体组件负责表单、聊天、图和 Trace。
- Learn: Composition API、props/emits、页面切换、localStorage 会话恢复、运行状态取消。
- Read or inspect: `frontend/src/App.vue`, `frontend/src/pages/*.vue`, `frontend/src/components/AgentManager.vue`, `WorkflowManager.vue`, `ChatRunner.vue`。
- Watch for: 项目没有 Vue Router 和 Pinia，状态集中会让入门更直观，但后续扩展要注意组件职责膨胀。
- Practice: 设计一个“最近运行摘要”只读卡片：列出需要从 `App.vue` 传下去的 props 和展示字段，不先写代码。
- NestJS transfer: 前端可以保留 Vue 3 组件思想，但建议为复刻版补一个 `src/api/types.ts`，避免 API 契约散落在组件里。
- Review: 解释 `selectedWorkflowId` 变化时为什么要清空当前运行状态并恢复对应 conversation。
- Document: `learning-notes/multi-agent-playground-frontend-state.md`

### Chapter 6: 图与 Trace 可视化

- Why it matters: 这是项目把“黑盒模型调用”变成“可观察工作流”的关键。
- Minimal mental model: 后端发 TraceEvent，前端用 `payload.node_id` 和 `payload.next_node_id` 找到当前节点与边。
- Learn: graph nodes/edges、布局策略、动态边、Trace 简化视图、工具验证卡片。
- Read or inspect: `frontend/src/components/GraphViewer.vue`, `TraceViewer.vue`, `backend/app/workflows/langgraph_adapter.py`, `backend/app/schemas.py`。
- Watch for: 图结构来自 workflow preview 或 run result，实际运行中的动态边可由 Trace 补充。
- Practice: 手写 5 个 TraceEvent，预测 `GraphViewer` 哪个节点 active、哪条边 active、`TraceViewer` 会如何分组。
- NestJS transfer: 把 Trace 设计成后端统一事件总线输出，而不是每个工作流随手拼 UI 所需字段。
- Review: 解释为什么 `peer_handoff` 需要 group node 和运行时动态 handoff 边。
- Document: `learning-notes/multi-agent-playground-graph-trace.md`

### Chapter 7: 设置与运行部署

- Why it matters: 真实应用不只跑在开发服务器里，桌面端要解决本地后端、资源路径、用户数据和 runtime 依赖。
- Minimal mental model: 原项目用 Electron 启动本地后端；NestJS 复刻版可以先做 Web 应用，再考虑桌面封装。
- Learn: model profile 保存、`.env` 管理、后端可执行文件、资源复制、Node/npm runtime 打包、NestJS ConfigModule。
- Read or inspect: `frontend/src/pages/SettingsPage.vue`, `backend/app/settings_bridge.py`, `desktop/main.cjs`, `desktop/preload.cjs`, `desktop/scripts/prepare-artifacts.mjs`, `backend/desktop_entry.py`。
- Watch for: 开发态和打包态路径完全不同，`app.isPackaged` 分支是阅读重点。
- Practice: 写一份运行部署 checklist：NestJS 服务端口、Vue API base URL、模型配置、数据库位置、SSE 连接、桌面封装是否延期。
- NestJS transfer: 用 `ConfigModule` 管理模型配置；先把配置存在数据库或 `.env`，再决定是否支持 UI 写回。
- Review: 解释为什么打包时要把 `backend/skills` 和 `backend/data` 加入 PyInstaller 资源。
- Document: `learning-notes/multi-agent-playground-desktop-packaging.md`

### Chapter 8: NestJS + Vue 复刻实战

- Why it matters: 学开源项目的最终目标不是背结构，而是能把核心模式迁移到自己的技术栈里。
- Minimal mental model: 复刻版不是逐行翻译，而是保留产品闭环和关键契约，用 NestJS 的模块体系重新组织后端。
- Learn: NestJS 模块拆分、DTO 契约、SSE、运行时服务、最小 workflow runner、Vue 复刻组件。
- Read or inspect: 回看 `routes.py`, `schemas.py`, `runtime.py`, `workflows/router_specialists/workflow.py`, `frontend/src/App.vue`, `GraphViewer.vue`, `TraceViewer.vue`。
- Watch for: 不要一开始复刻所有 5 种 workflow；先做 Router 或 Planner 的最小闭环。
- Practice: 设计并实现一个最小版本：创建 Agent、创建 Router Workflow、运行 prompt、返回 assistant message、实时输出 Trace、前端高亮图节点。
- Review: 列出原项目中哪些能力进入 v1，哪些延期到 v2。
- Document: `learning-notes/multi-agent-playground-nestjs-vue-capstone.md`

## Project Ladder

- Guided drill: 追踪一次 Run 的完整链路，并写出每一步对应文件和函数。
- Mini project: 写一份 NestJS + Vue 复刻版架构草图，包含模块、DTO、表结构、SSE 事件和 Vue 页面。
- Capstone: 用 NestJS + Vue 实现最小多 Agent Playground。v1 只需支持 Router 或 Planner 一种工作流，但必须包含 Agent 管理、Workflow 管理、Run、Trace、Graph 的端到端闭环。

## Review Queue

| Topic | Next Review | Weak Spot | Status |
| --- | --- | --- | --- |
| 端到端 Run 闭环 | Day 1 | SSE 与 fallback 的关系 | Planned |
| 数据契约 | Day 3 | TraceEvent payload 的前端依赖 | Planned |
| 五种工作流 | Day 7 | planner/supervisor/peer 的控制权差异 | Planned |
| NestJS 迁移映射 | Day 10 | 原 FastAPI/LangGraph 概念如何翻译成 NestJS 模块 | Planned |
| 运行部署 | Day 14 | Web 部署和桌面封装的优先级 | Planned |

## Open Questions

- 项目中的中文文案是否在实际 UI 中显示正常，还是源码已经存在编码损坏？
- 是否需要补一套最小测试，例如后端 schema/store 单测和前端 API/Trace 解析单测？
- NestJS 复刻版 v1 是否只做 Web 应用，还是需要同时考虑 Electron 桌面端？
- 工作流 runner 是否先手写 TypeScript 状态机，还是直接调研 LangGraphJS？
- 数据层更偏 Prisma 还是 TypeORM？这会影响实体、迁移和测试写法。

## First Lesson: 一个最小闭环

把项目先想成一个“带摄像头的任务执行器”：

1. 你在 `ChatRunner.vue` 输入任务。
2. `App.vue` 的 `handleRun` 组装 `workflow_id` 和 `user_input`。
3. `api.js` 优先调用 `/api/runs/stream`，后端边执行边发 `trace` 事件。
4. `routes.py` 找到 workflow，交给 `_dispatch_run`。
5. `_dispatch_run` 根据 workflow type 调用某个 `run_*` 函数。
6. workflow 运行时不断生成 `TraceEvent`。
7. 前端收到 Trace 后更新 `displayedTrace` 和 `replayNodeId`，于是图和 Trace 面板动起来。
8. 最终 `final` 事件返回 `assistant_message`，聊天区显示答案。

轻量检查题：如果后端只返回最终答案但没有 Trace，用户还能聊天，但这个项目最有辨识度的哪一部分会失效？

## Progress Tracking

- 当前进度记录：`learning-notes/multi-agent-playground-progress.md`
- 续学规则：每次继续学习前先读进度记录；先做 2-3 个回忆检查，再继续新内容。
- 二刷规则：如果学习者要求重讲，不重复旧讲法；先根据进度记录识别弱点，再换一个角度重讲并补新例子。

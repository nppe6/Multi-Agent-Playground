# Multi-Agent Playground 学习进度记录

## Resume Snapshot

当前在 Chapter 1：产品闭环与启动路径，已完成前端 `handleRun()`、后端 `/api/runs/stream`、`queue -> Subject` 类比、`buffer` 解析 SSE frame，以及 NestJS 迁移映射。学习者已能说清 `TraceEvent` 让工作流不再黑盒，也能把 `WorkflowRuntimeService.dispatch()` 对应到原项目 `_dispatch_run()`。当前进入 Chapter 1 实战：最小 Run Stream 协议。练习目标是不接真实 LLM/Agent/DB，先用 NestJS + Vue 跑通 `trace -> trace -> final -> end`。下一次先打开 `learning-notes/multi-agent-playground-run-stream-practice.md`，再决定是建独立 `run-stream-demo/` 还是放进未来复刻项目。

## 前置知识基线

| 前置知识 | 当前水平 | 证据 / 说明 | 触发补课时机 |
| --- | --- | --- | --- |
| Vue 组件数据流与顶层状态管理 | familiar | 已能解释为什么 `handleRun()` 放在 `App.vue` 更利于统一跟踪运行状态。 | 进入 Chapter 5 前复盘 `props/emits` 与 composable/store 边界。 |
| fetch、SSE、AbortController | familiar | 已能总结当前项目用 `fetch` 建立 SSE，并用 `AbortController` 中断。 | 读 `api.js` 的 `ReadableStream` 循环时补一个短 capsule。 |
| 异步竞态与 UI 写入资格 | familiar | 已能区分 `AbortController` 管请求取消，`replayToken` 管 UI 渲染资格。 | 二刷 Chapter 1 或遇到并发运行 bug 时加练习。 |
| FastAPI streaming / Python queue / thread | aware | Python 了解但不熟，后续 Python 知识需要优先用 Node.js/NestJS 类比讲解。 | 进入 `/api/runs/stream` 前先讲 Node.js 等价模型，再回到 Python 源码。 |
| LangGraph 工作流状态机 | zero/aware | 目前只知道项目会进入工作流，还没读节点和边。 | Chapter 4 前插入状态机与 DAG 最小模型。 |
| NestJS Controller / Service / SSE | 待自评 | 最终目标需要，但当前对 NestJS 熟悉度还未诊断。 | 完成 FastAPI SSE 后，用 1-2 个问题快速确认再迁移。 |

## 学习偏好

- 后续涉及 Python、FastAPI、LangGraph、thread、queue、StreamingResponse 等内容时，先说明它在当前项目里的职责，再用 Node.js/NestJS 的对应概念类比。
- 类比优先级：Node.js 事件循环、EventEmitter、Stream、AsyncIterator、RxJS Subject/Observable、NestJS Controller/Service/SSE。
- 不要求深入 Python 语言细节，除非该细节会直接影响 NestJS 复刻设计。

## 架构决策记录

- 最终复刻目标保持 NestJS + Vue，不切换为 Koa2 主实现。
- 讲解时允许用 Koa2/Node.js 做底层机制类比，必要时可以先做极简 Koa2 SSE demo 作为垫脚石。
- 最终落地仍采用 NestJS 的 Controller / Service / Module / DTO / RuntimeService 分层。
- 决策依据：项目复杂度主要在多模块协作、运行时编排、Trace 契约和可扩展 workflow，而不是单纯 HTTP 路由轻重。
- Run Stream 实战采用 NestJS `@Post + @Res()` 手写 SSE，以保留原项目 `POST /runs/stream` 的 body 语义；`@Sse()` 后续可作为 GET SSE 对比学习。

## 当前课程状态

- 学习路线：`learning-notes/multi-agent-playground-roadmap.md`
- 最终目标：用 NestJS + Vue 实现类似当前项目的多 Agent Playground。
- 当前章节：Chapter 1：产品闭环与启动路径。
- 当前小节：Chapter 1 实战：最小 Run Stream 协议。
- 当前状态：进行中。
- 下一次续学入口：打开实战 brief，先实现事件契约和假的 `WorkflowRuntimeService.dispatch()`。
- 对话回放：`learning-notes/multi-agent-playground-session-history.md`

## 已学习内容

### 1. TraceEvent 的核心价值

已讲解：

- 如果只有最终答案，没有 Trace，项目会退化成普通聊天黑盒。
- `TraceEvent` 是工作流可解释性和可调试性的运行时证据。
- Graph 和 Trace 面板依赖 `TraceEvent.payload.node_id`、`next_node_id` 等字段工作。

学习证据：

- 学习者指出：没有 Trace 时“不知道需求是怎么流转的，就像黑盒一样”，会丢失项目核心价值和工作流价值。

当前掌握度：

- 强。

### 2. 为什么 `handleRun()` 放在 `App.vue`

已讲解：

- `ChatRunner.vue` 只负责输入和聊天展示。
- 一次运行同时影响聊天区、Graph、Trace、会话、错误、停止控制等多个区域。
- `App.vue` 是当前项目的跨组件运行状态中心。
- NestJS + Vue 复刻时可迁移成 `useRunSession()` 或 Pinia store，但职责仍应是“运行编排中心”。

学习证据：

- 学习者指出：放在外层可以统一触发跟踪；如果写在组件内再向外传，会让数据流复杂化。

当前掌握度：

- 强。

### 3. fetch + SSE + AbortController

已讲解：

- 当前项目用原生 `fetch` 请求 `/api/runs/stream`。
- 后端返回 `text/event-stream`，前端通过 `response.body.getReader()` 读取流。
- `AbortController` 是浏览器内置 Web API，不需要 import。
- `controller.signal` 传给 `fetch`，`controller.abort()` 可以中断请求。
- `fetch + ReadableStream` 适合 POST body + SSE；标准 `EventSource` 更适合 GET SSE。

学习证据：

- 学习者总结：当前项目“使用 fetch 进行 SSE 连接，然后使用 AbortController 进行中断”。

当前掌握度：

- 中强。已理解用途；二刷时可补充 `ReadableStream` 和 SSE frame 解析细节。

### 4. `AbortController` 和 `replayToken` 的差异

已讲解：

- `AbortController` 负责取消旧网络请求，尽量让旧 SSE 停止产生数据。
- `replayToken` 负责做前端逻辑身份校验，防止旧异步回调继续改 UI。
- 两者不是重复机制，一个管请求，一个管 UI 写入资格。

学习证据：

- 学习者总结：`AbortController` 清除之前未完成请求；`replayToken` 防止新请求发出后仍渲染旧 UI。

当前掌握度：

- 强。

### 5. 后端 SSE：`queue + worker thread + event_stream()`

已讲解：

- `/api/runs/stream` 不是等工作流结束后一次性返回，而是边执行边推送事件。
- worker thread 负责执行 `_dispatch_run()`，并通过 `on_trace()` 把 TraceEvent 放入 `queue`。
- `event_stream()` 负责从 `queue` 取事件，把 `trace/final/error/end` 转成 SSE frame。
- `queue` 的核心价值是解耦：工作流只生产事件，HTTP SSE 只发送事件。
- NestJS 复刻时可用 RxJS `Subject`、事件总线或 async iterator 承担 Python `queue` 的角色。

学习证据：

- 学习者已理解：NestJS/RxJS 的 `Subject` 更像 Python 代码里的 `queue`，二者都是“事件中转站”。
- 学习者能说出成功路径主要事件为 `trace -> final -> end`；需要补充边界意识：`final/end` 是成功收束的硬信号，`trace` 取决于工作流是否产生中间事件。

当前掌握度：

- 中。已理解 `queue` 的类比位置；还需要继续把 `trace/final/error/end` 四类事件串成完整运行闭环。

### 6. 前端 SSE 读取：`ReadableStream + buffer + parseSseFrame()`

已讲解：

- `reader.read()` 每次拿到的是网络 chunk，不保证刚好是一条完整 SSE 事件。
- `buffer` 保存“已收到但未完全处理”的文本。
- 前端用 `\n\n` 找到完整 SSE frame，前半段交给 `parseSseFrame()`，后半段继续留在 `buffer` 等下一块数据。
- `trace/final/error` 分别触发 `onTrace/onFinal/onError`；后端 `end` 最终体现为流结束后的 `onEnd()`。

学习证据：

- 学习者能解释：`buffer` 作为切割缓冲，每次读取前半段完整内容，后面不完整的先保留不解析。

当前掌握度：

- 中强。已理解 buffer 的必要性；后续可二刷 SSE frame 格式和 JSON parse 边界。

### 7. NestJS 迁移映射：Run Stream 协议

已讲解：

- `run_workflow_stream()` 可映射为 NestJS 的 `RunsController.stream()`。
- `_dispatch_run()` 可映射为 `WorkflowRuntimeService.dispatch()`。
- `queue.Queue` 可映射为 RxJS `Subject`、事件总线或 async iterator。
- `TraceEvent / final / error / end` 应作为前后端共享的 Run Stream 事件契约。

学习证据：

- 学习者能正确指出：NestJS 设计里的 `WorkflowRuntimeService.dispatch()` 相当于原项目 `_dispatch_run()`。
- 学习者能判断 `TraceEventDto` 的关键字段：当前 agent/node id、下一步 id、节点类型是 agent 还是 skill。已补充为实战版 `payload.node_id`、`payload.next_node_id`、`payload.node_kind`、`agent_id`、`skill_id`。
- 学习者理解 `title/detail` 的价值：它们服务前端展示，避免前端把 `type + payload` 再翻译成人类可读文案；`type/payload` 保持给程序做分类、高亮和跳转。

当前掌握度：

- 中强。已理解核心职责映射；下一步可进入 Chapter 1 实战任务设计或开始 Chapter 2 数据契约。

## 当前弱点与待修复点

- `ReadableStream` 的逐块读取过程只做了概念理解，还需要学习者自己复述 `api.js` 的 `while` 循环和 `parseSseFrame()`。
- 后端 SSE 的职责拆分已讲，但还需要通过检查题确认是否真正理解 `queue` 的解耦价值。
- NestJS 中如何实现同样的 SSE 端点只做了方向映射，之后需要画出 `RunsController.stream()` + `WorkflowRuntimeService.dispatch()`。

## 下次回访续学脚本

回访时先从这个简短回顾开始：

> 上次我们学到前端运行状态机：`ChatRunner.submit()` 把任务交给 `App.vue handleRun()`，`handleRun()` 用 `fetch` 建立 SSE，用 `AbortController` 中断旧请求，用 `replayToken` 防止旧回调污染 UI。你已经能说清 Trace 是项目的运行时证据。今天从后端 `/api/runs/stream` 继续，看它如何用 queue 把工作流事件变成 SSE。

回访检查题：

1. `TraceEvent` 解决了什么黑盒问题？
2. 为什么 `handleRun()` 不放在 `ChatRunner.vue`？
3. `AbortController` 和 `replayToken` 的区别是什么？

如果 3 个问题都答得顺，继续后端 SSE。  
如果第 3 个问题卡住，先二刷“请求取消 vs UI 写入资格”。

## 二刷重讲路径

当学习者要求二刷 Chapter 1 时，不要重复原讲法，按下面顺序重讲：

1. 从“竞态条件”切入：两个运行请求先后返回导致 UI 串台。
2. 再解释 `AbortController`：它尽量停止旧请求。
3. 再解释 `replayToken`：它防止旧异步分支写入新 UI。
4. 再把 `TraceEvent` 放回产品目标：运行过程可见、可追踪、可解释。
5. 最后迁移到 NestJS + Vue：`useRunSession()` + `RunsController.stream()` + `TraceEventDto`。

二刷练习：

- 给出一个场景：用户先运行 Workflow A，马上切到 Workflow B 并运行，A 比 B 更晚返回。让学习者说明如果没有 `AbortController` 和 `replayToken`，聊天区、Graph、Trace 分别会怎么错乱。

## 下一步学习任务

### Chapter 1 实战任务：最小 Run Stream 协议

目标：

- 用 NestJS + Vue 实现一次假的 workflow 流式运行。
- 后端发送 `trace -> trace -> final -> end`。
- 前端实时显示 trace、最终回复和 loading 状态。
- 当前正在设计 Step 2：假的 `WorkflowRuntimeService.dispatch()`，先模拟多个 Trace，再返回 final。

将要阅读：

- `backend/app/routes.py`
- `frontend/src/api.js`
- `learning-notes/multi-agent-playground-run-loop.md`

下一题：

> 你想先用伪代码画出 NestJS 模块结构，还是直接在一个小 demo 里实现 `POST /runs/stream`？

## 复习计划

- 立即复习：回答“TraceEvent、AbortController、replayToken 分别解决什么问题”。
- Day 1：不看代码复述 `ChatRunner -> App.vue -> api.js -> /api/runs/stream`。
- Day 3：手写一个 `useRunSession()` 的状态字段清单。
- Day 7：把当前 FastAPI SSE 链路翻译成 NestJS 端点设计。

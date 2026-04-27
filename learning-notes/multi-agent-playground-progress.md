# Multi-Agent Playground 学习进度记录

## 当前课程状态

- 学习路线：`learning-notes/multi-agent-playground-roadmap.md`
- 最终目标：用 NestJS + Vue 实现类似当前项目的多 Agent Playground。
- 当前章节：Chapter 1：产品闭环与启动路径。
- 当前小节：前端 `handleRun()` 运行生命周期，以及即将进入后端 `/api/runs/stream`。
- 当前状态：进行中。
- 下一次续学入口：从后端 `run_workflow_stream()` 的 `queue + worker thread + event_stream()` 结构继续。

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

## 当前弱点与待修复点

- `ReadableStream` 的逐块读取过程只做了概念理解，还没有逐行读 `api.js` 的 `while` 循环和 `parseSseFrame()`。
- 后端 SSE 的实现还没学：`queue.Queue`、后台线程、`StreamingResponse`、`yield event/data`。
- NestJS 中如何实现同样的 SSE 端点还没讲：需要之后映射到 `@Sse()`、RxJS Observable 或手写 response stream。

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

### Chapter 1 后端半段：`/api/runs/stream`

目标：

- 理解后端为什么用 `queue` 连接工作流执行和 SSE 响应。
- 读懂 `run_workflow_stream()` 的最小结构。
- 能把 FastAPI 实现翻译成 NestJS 实现草图。

将要阅读：

- `backend/app/routes.py`
- `frontend/src/api.js`

下一题：

> 为什么后端要用 `queue` 作为中间缓冲，而不是在工作流函数里直接 `yield` SSE 给前端？

## 复习计划

- 立即复习：回答“TraceEvent、AbortController、replayToken 分别解决什么问题”。
- Day 1：不看代码复述 `ChatRunner -> App.vue -> api.js -> /api/runs/stream`。
- Day 3：手写一个 `useRunSession()` 的状态字段清单。
- Day 7：把当前 FastAPI SSE 链路翻译成 NestJS 端点设计。

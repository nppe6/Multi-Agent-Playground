# Multi-Agent Playground 学习对话记录

## 记录范围

- 主题：Chapter 1 产品闭环、流式运行、SSE、NestJS 复刻映射与实战准备
- 学习目标：最终用 NestJS + Vue 实现类似当前项目的多 Agent Playground
- 相关文件：
  - `frontend/src/App.vue`
  - `frontend/src/api.js`
  - `backend/app/routes.py`
  - `backend/app/schemas.py`
  - `frontend/src/components/GraphViewer.vue`
  - `frontend/src/components/TraceViewer.vue`
  - `learning-notes/multi-agent-playground-roadmap.md`
  - `learning-notes/multi-agent-playground-progress.md`
  - `learning-notes/multi-agent-playground-run-loop.md`
  - `learning-notes/multi-agent-playground-run-stream-practice.md`

## 1. 学习路线与最终目标

学习者一开始要求使用 `interactive-learning-coach` 来学习这个开源项目，先分析项目结构，生成学习路线图，再按模块讲解并设计实战任务。

随后补充最终目标：

> 使用 NestJS + Vue 实现类似当前这样的项目内容。

因此课程路线被确定为双轨：

- 读懂原项目：FastAPI + LangGraph + Vue + Electron。
- 迁移复刻：NestJS + Vue，保留 Agent、Workflow、Run Stream、Trace、Graph、Settings 等核心能力。

已创建或更新：

- `learning-notes/multi-agent-playground-roadmap.md`
- `learning-notes/multi-agent-playground-progress.md`
- `.agent-os/context/project-overview.md`

## 2. TraceEvent 的核心价值

学习者指出一个关键问题：

> 不知道这个需求是怎么流转的，就像黑盒一样，丢失了这个项目的核心价值，工作流的丧失。

课程解释：

- 如果只有最终答案，项目会退化成普通聊天。
- `TraceEvent` 是工作流过程的运行时证据。
- Graph 和 Trace 面板让用户看到“谁在执行、为什么跳转、下一步去哪、产生了什么结果”。

学习结论：

> Trace 不是装饰 UI，而是多 Agent Playground 的核心价值之一。

## 3. 为什么运行逻辑放在 `App.vue`

学习者观察：

> 因为放在总的 `App.vue` 里面发送出去，这样流转的 UI 才能够一次性进行触发跟踪。如果写在组件里面，需要传递出来，会将数据流向复杂化，应该放在最外面进行总的管理。

课程确认：

- `ChatRunner.vue` 更适合作为输入和展示组件。
- 一次运行会影响聊天区、Graph、Trace、错误状态、停止控制、会话等多个区域。
- `App.vue` 在当前项目中承担“运行编排中心”的角色。

NestJS + Vue 复刻时可迁移为：

- `useRunSession()`
- 或 Pinia store
- 但职责仍是“统一管理一次运行”。

## 4. AbortController 与 replayToken

学习者疑问：

> `AbortController` 是什么东西，为什么可以直接 new，似乎没看见哪里定义？

课程解释：

- `AbortController` 是浏览器内置 Web API。
- 不需要 import。
- `controller.signal` 传给 `fetch`。
- `controller.abort()` 可以中断请求。

随后学习者总结：

> 当前项目使用 fetch 进行 SSE 连接，然后使用 AbortController 进行中断。

进一步区分：

- `AbortController`：负责取消旧网络请求。
- `replayToken`：负责防止旧异步回调继续写入新 UI。

学习者总结：

> `AbortController` 主要解决请求之前清除之前没有完成的请求内容；`replayToken` 主要用来前端做区分，防止新的请求出去了还在渲染旧内容 UI。

课程确认该理解正确。

## 5. 后端 SSE：`queue + worker thread + event_stream()`

课程从 `backend/app/routes.py` 的 `run_workflow_stream()` 进入后端半段。

核心结构：

```text
worker thread
执行 _dispatch_run()，产生 trace/final/error/end
        ↓
queue
临时保存事件
        ↓
event_stream()
取事件，格式化成 SSE frame
        ↓
前端 fetch reader
```

学习者疑问：

> `queue` 是什么东西，是第三方依赖包还是什么？

课程解释：

- `queue` 是 Python 标准库，不是第三方包。
- `queue.Queue()` 是线程安全的先进先出队列。
- 当前项目里它是运行期内存缓冲，不是数据库，也不是外部消息队列。

对应 Node/NestJS 类比：

```text
Python queue.Queue
≈ NestJS / RxJS Subject
≈ 事件中转站
```

学习者理解后，课程记录：

> `Subject` 更像 Python 代码里的 `queue`，二者都是事件中转站。

## 6. Python 内容的讲解偏好

学习者提出：

> 最终目标是使用 NestJS + Vue 实现复刻。我对 Python 属于了解但不清楚，后续涉及 Python 的知识内容可以通过 Node.js 进行类比讲解。

已记录为学习偏好：

- 后续讲 Python、FastAPI、LangGraph、thread、queue、StreamingResponse 时，先说明它在当前项目里的职责，再用 Node.js/NestJS 类比。
- 类比优先级：
  - Node.js 事件循环
  - EventEmitter
  - Stream
  - AsyncIterator
  - RxJS Subject/Observable
  - NestJS Controller/Service/SSE

## 7. NestJS 还是 Koa2

学习者疑问：

> 最终目标是 NestJS + Vue 复刻，使用 NestJS 是否会框架过重？需要考虑换成 Koa2 更轻量一点吗？

课程建议：

> 最终项目用 NestJS；讲解时用 Koa2/Node.js 帮助理解底层；必要时可以先做一个 Koa2 极简 SSE demo 作为垫脚石，但不要把最终复刻目标切到 Koa2。

决策理由：

- 当前项目不是简单 API 服务。
- 复杂度主要来自 Agent、Workflow、Run、Trace、Settings、Runtime 等模块协作。
- NestJS 的模块化、依赖注入、DTO、Controller/Service 分层更适合作为最终工程形态。

该决策已写入：

- `learning-notes/multi-agent-playground-roadmap.md`
- `learning-notes/multi-agent-playground-progress.md`

## 8. SSE 事件协议：trace / final / error / end

课程解释后端会放入 4 类事件：

```python
stream_queue.put(("trace", event.model_dump()))
stream_queue.put(("final", result.model_dump()))
stream_queue.put(("error", {"message": str(error)}))
stream_queue.put(("end", None))
```

学习者回答成功路径：

> trace final end 这三种。

课程补充：

- 正常路径通常是 `trace -> final -> end`。
- 但协议上最硬的成功收束信号是 `final + end`。
- `trace` 是中间过程事件，是否存在取决于 workflow 是否产生中间事件。

总结：

```text
trace = 过程
final = 结果
error = 失败
end = 收尾
```

## 9. 前端 SSE 读取与 buffer

课程阅读 `frontend/src/api.js`：

- `response.body.getReader()` 读取二进制 chunk。
- `TextDecoder` 转成字符串。
- `buffer` 保存已收到但未完全解析的内容。
- 用 `\n\n` 切出完整 SSE frame。
- `parseSseFrame()` 解析 `event` 和 `data`。
- 根据事件类型调用 `onTrace`、`onFinal`、`onError`、`onEnd`。

学习者解释：

> `buffer` 是作为一个切割，每次都是读取到前半段完整的内容，后边还不完整的就先不读取。

课程确认：

> `buffer` 是为了把不稳定的网络分块，重新整理成稳定的 SSE 事件帧。

核心经验：

```text
chunk 不等于 message
```

## 10. NestJS 迁移映射

课程将原项目后端映射为 NestJS：

```text
run_workflow_stream()
≈ RunsController.stream()

_dispatch_run()
≈ WorkflowRuntimeService.dispatch()

queue.Queue
≈ RxJS Subject / 事件通道

event_stream()
≈ Observable<MessageEvent> / SSE response

TraceEvent / final / error / end
≈ Run Stream 事件契约
```

学习者回答：

> `WorkflowRuntimeService.dispatch()` 相当于是 `_dispatch_run`。

课程确认正确。

## 11. `progressSubject` 与 SSE

学习者提到类似代码：

```ts
for await (const chunk of openingGenerator) {
  fullOpeningStatement += chunk;

  progressSubject.next({
    type: MockInterviewEventType.START,
    sessionId,
    resultId,
    content: fullOpeningStatement,
    isStreaming: true,
  });
}
```

课程解释：

- `generateOpeningStatementStream()` 是 AI 内容流，逐块吐 chunk。
- `progressSubject.next()` 是把业务进度推到事件通道。
- `@Sse()` 或 `res.write()` 才是真正把 SSE 发给前端。

类比：

```text
for await chunk
负责消费 AI 流

progressSubject.next
负责把业务进度推到 SSE 通道

@Sse / res.write
负责把 SSE 真正发给前端
```

重要提醒：

- `progressSubject` 不是 SSE 本身。
- 它更像 Python 的 `queue`。
- 如果是全局 Subject，多用户或多 session 可能串流，应按 `sessionId` 管理多个 Subject。

## 12. POST SSE 与 `@Sse()`

课程修正了一个实战点：

- NestJS `@Sse()` 通常更适合 GET SSE。
- 当前项目是 `POST /runs/stream`，需要提交 body：`workflowId`、`userInput`、`conversationId`。
- 因此实战版优先采用：

```ts
@Post('stream')
stream(@Body() dto, @Res() res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.write(...);
}
```

长期也可以采用两步式：

```text
POST /runs
创建 run，返回 runId

GET /runs/:runId/progress
用 @Sse() 监听进度
```

但为了贴近原项目，Chapter 1 实战先采用 `POST + @Res()`。

## 13. Chapter 1 实战任务

学习者选择：

> 先做实战。

已创建：

- `learning-notes/multi-agent-playground-run-stream-practice.md`

实战目标：

```text
不用真实 LLM
不用真实 Agent
不用数据库

只跑通：
trace -> trace -> final -> end
```

建议目录：

```text
run-stream-demo/
  api/
    src/
      runs/
        dto.ts
        runs.controller.ts
        workflow-runtime.service.ts
        runs.module.ts
      app.module.ts
      main.ts
  web/
    src/
      api/
        runStream.ts
      App.vue
```

实战路线：

1. 搭建最小 NestJS 服务。
2. 定义 Run Stream 事件契约。
3. 实现假的 `WorkflowRuntimeService.dispatch()`。
4. 实现 `POST /runs/stream`。
5. 用 fetch + buffer 在 Vue 前端解析 SSE。

## 14. TraceEventDto 设计

学习者判断：

> `TraceEventDto` 知道当前运行的 agent id，以及下一步的 id，以及类型是 agent 还是 skill。

课程确认这是关键判断。

实战版 `TraceEventDto`：

```ts
export interface TraceEventDto {
  type: TraceEventType;
  title: string;
  detail: string;
  at: string;
  payload: TraceEventPayload;
}

export interface TraceEventPayload {
  node_id?: string;
  next_node_id?: string;
  node_kind?: 'start' | 'logic' | 'agent' | 'skill' | 'final' | 'end';

  agent_id?: string;
  agent_name?: string;

  skill_id?: string;
  skill_name?: string;

  [key: string]: unknown;
}
```

学习者解释 `title/detail` 的价值：

> 是更加方便于前端的展示吗？

课程确认：

- `title/detail` 给用户看。
- `type/payload` 给程序用。
- 这样前端不用把 `type + payload` 再翻译成人类文案。

总结：

```text
title/detail = 展示语义
type/payload = 结构语义
```

## 15. 当前状态与下一步

当前进度：

- Chapter 1 理解部分已基本完成。
- 正在进入 Chapter 1 实战。
- 实战第一步应先搭建最小 NestJS 服务。

下一步建议：

```text
1. 创建 run-stream-demo/api NestJS 服务
2. 实现 DTO
3. 实现假的 WorkflowRuntimeService.dispatch()
4. 实现 POST /runs/stream
5. 用 curl 或 fetch 验证 SSE 输出
```

当前关键问题：

> 是否现在开始创建 `run-stream-demo/api` 最小 NestJS 服务？


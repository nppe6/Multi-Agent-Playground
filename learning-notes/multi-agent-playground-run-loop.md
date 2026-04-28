# Multi-Agent Playground 运行闭环笔记

## 所属路线

- 路线图：`learning-notes/multi-agent-playground-roadmap.md`
- 章节：Chapter 1：产品闭环与启动路径
- 当前主题：前端 `fetch` SSE 与后端 `queue + worker thread + StreamingResponse`

## 最小心智模型

一次运行不是“前端发请求，后端算完再返回”这么简单。这个项目要一边执行工作流，一边把中间 Trace 推给前端，所以后端把运行拆成两条协作线：

- worker thread：真正执行 `_dispatch_run()`，不断产生 Trace，最后产生 final 或 error。
- event stream：守着 `queue`，谁被放进来就把谁格式化成 SSE frame 返回给前端。

`queue` 是两条线之间的缓冲区。它让“工作流怎么执行”和“HTTP 流怎么输出”解耦。

## 源码走读：后端半段

入口在 `backend/app/routes.py` 的 `run_workflow_stream()`：

1. 读取 workflow，不存在就 404。
2. 如果没有 conversation，就创建一个 conversation。
3. 创建 `stream_queue`。
4. 定义 `on_trace(event)`：每次工作流产生 `TraceEvent`，就 `put(("trace", event))`。
5. 启动后台 `worker()` 执行 `_dispatch_run(..., on_event=on_trace)`。
6. worker 成功后保存 user/assistant message，并 `put(("final", result))`。
7. worker 失败后 `put(("error", message))`。
8. worker 最后一定 `put(("end", None))`。
9. `event_stream()` 循环 `get()` queue，转成：

```text
event: trace
data: {...}

event: final
data: {...}

event: end
data: {}
```

## 为什么需要 queue

如果把工作流和 SSE 输出绑在同一个函数里，代码会很快混在一起：执行节点、捕获异常、保存消息、拼 SSE 字符串、结束连接都挤在一条控制流里。`queue` 的价值是把它拆成两个职责：

- 生产者：工作流负责产生事件，不关心 HTTP 怎么发。
- 消费者：SSE 响应负责发送事件，不关心事件为什么产生。

这也让同步的、可能耗时的工作流可以在后台线程跑，而 HTTP 响应保持打开，持续向前端吐事件。

## 前端如何接住

前端 `frontend/src/api.js` 的 `runWorkflowStream()`：

1. 用 POST `fetch("/api/runs/stream")` 发起请求。
2. 通过 `response.body.getReader()` 获取流 reader。
3. 用 `TextDecoder` 把二进制 chunk 解码成字符串。
4. 把字符串累积到 `buffer`。
5. 用空行 `\n\n` 切出一个完整 SSE frame。
6. `parseSseFrame()` 解析出 `event` 和 `data`。
7. 按事件名调用 `onTrace`、`onFinal`、`onError`。

## NestJS 迁移映射

复刻时可以先保留同样的责任边界：

- `RunsController.stream()`：接收请求，打开 SSE 响应。
- `WorkflowRuntimeService.dispatch()`：执行 workflow，负责调用 `emitTrace()`。
- `RunEventBus` 或 RxJS `Subject`：承担当前 Python `queue` 的角色。
- `TraceEventDto` / `RunFinalDto` / `RunErrorDto`：统一前后端事件契约。

最小实现可以先用 RxJS `Subject` 模拟 queue，等工作流复杂后再抽成事件总线。

## Node/Koa2 理解桥

后续不用死记 Python 的 `threading + queue`。迁移到 Node.js 时，可以把它理解成三个角色：

- Producer：工作流运行器，负责产生 `trace/final/error/end`。
- Channel：事件通道，负责临时转交事件。
- Consumer：HTTP SSE 响应，负责把事件写给浏览器。

Python 里这三个角色大概是：

```text
worker() / _dispatch_run() -> queue.Queue -> event_stream()
```

Node.js 里可以对应成：

```text
WorkflowRuntime.dispatch() -> EventEmitter / Subject / AsyncIterator -> response.write()
```

Koa2 极简心智模型：

```ts
router.post('/runs/stream', async (ctx) => {
  ctx.set('Content-Type', 'text/event-stream');

  runtime.dispatch(input, {
    onTrace: (event) => {
      ctx.res.write(`event: trace\ndata: ${JSON.stringify(event)}\n\n`);
    },
  }).then((result) => {
    ctx.res.write(`event: final\ndata: ${JSON.stringify(result)}\n\n`);
    ctx.res.write('event: end\ndata: {}\n\n');
    ctx.res.end();
  });
});
```

这个 Koa2 写法容易理解，但最终项目不建议把所有逻辑都堆在 route 里。NestJS 复刻时应该保留分层：

```text
RunsController.stream()
  -> WorkflowRuntimeService.dispatch()
  -> Subject<MessageEvent>
  -> 前端 fetch reader
```

## 常见误区

- 误区：SSE 只能用 `EventSource`。
  - 修正：`EventSource` 更适合 GET SSE；这个项目需要 POST body，所以用 `fetch + ReadableStream`。
- 误区：`queue` 是为了存数据库。
  - 修正：这里的 `queue` 是运行期内存缓冲，不是持久化。
- 误区：有 `AbortController` 就不需要后端 `end`。
  - 修正：`AbortController` 是客户端取消；`end` 是服务端正常结束信号，两者解决的问题不同。

## 检查题

如果后端没有 `queue`，而是让 `_dispatch_run()` 直接负责 `yield` SSE，会让哪些职责混在一起？

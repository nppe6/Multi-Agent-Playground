# Chapter 1 实战：最小 Run Stream 协议

## 实战目标

用 NestJS + Vue 复刻当前项目最核心的一条链路：用户发起一次运行，后端按 SSE 流式推送运行事件，前端实时显示过程和结果。

这一版不接真实 LLM，不接真实 Agent，也不接数据库。先把协议跑通：

```text
trace -> trace -> final -> end
```

## 实现交接 Brief

最小可运行目标：

- 创建一个独立 `run-stream-demo/api` NestJS 服务。
- 实现 `POST /runs/stream`。
- 请求体包含 `workflowId` 和 `userInput`。
- 后端不接真实 LLM、不接真实 Agent、不接数据库，只模拟两条 trace、一个 final、一个 end。

刻意排除：

- 不做登录和用户隔离。
- 不做真实 Workflow 编辑器。
- 不做数据库持久化。
- 不做真实模型调用。
- 不做完整 Graph UI，只先验证事件协议。

检查点：

1. DTO 完成：能用 TypeScript 表达 `trace/final/error/end`。
2. Runtime 完成：`WorkflowRuntimeService.dispatch()` 能通过 `onTrace` 发出模拟 Trace，并返回 final。
3. Controller 完成：`POST /runs/stream` 能设置 SSE header，并用 `res.write()` 输出 `event/data`。
4. 命令行验证：用 curl 或 fetch 能看到 `trace -> final -> end`。
5. 前端验证：Vue 页面能显示 Trace 列表、最终回复和 loading 结束。

## 你要学会的东西

- 把原项目 `run_workflow_stream()` 翻译成 NestJS `RunsController.stream()`。
- 把原项目 `_dispatch_run()` 翻译成 `WorkflowRuntimeService.dispatch()`。
- 把原项目 `queue.Queue` 翻译成 RxJS `Subject` 或 Observable 事件通道。
- 在 Vue 里用 `fetch + ReadableStream + buffer` 解析后端 SSE。

## 最小目录建议

如果做独立 demo，可以用这个结构：

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

如果直接在未来复刻项目里做，模块名也建议保持：

```text
runs
runtime
trace
```

## 后端任务

### Step 1：定义事件契约

先定义前后端共享的事件类型：

```ts
export type RunStreamEvent =
  | { type: 'trace'; data: TraceEventDto }
  | { type: 'final'; data: RunFinalDto }
  | { type: 'error'; data: RunErrorDto }
  | { type: 'end'; data: Record<string, never> };

export interface TraceEventDto {
  type: string;
  title: string;
  detail: string;
  at: string;
  payload: {
    node_id?: string;
    next_node_id?: string;
    node_kind?: 'start' | 'logic' | 'agent' | 'skill' | 'final' | 'end';
    agent_id?: string;
    agent_name?: string;
    skill_id?: string;
    skill_name?: string;
    [key: string]: unknown;
  };
}

export interface RunRequestDto {
  workflowId: string;
  userInput: string;
  conversationId?: string;
}

export interface RunFinalDto {
  assistantMessage: string;
  artifacts: {
    routeAgentName?: string;
  };
}

export interface RunErrorDto {
  message: string;
}
```

### Step 2：实现假的 workflow runtime

先模拟两个 Trace，然后返回 final：

```ts
@Injectable()
export class WorkflowRuntimeService {
  async dispatch(
    dto: RunRequestDto,
    hooks: { onTrace?: (event: TraceEventDto) => void },
  ): Promise<RunFinalDto> {
    hooks.onTrace?.({
      type: 'node_started',
      title: 'Planner Started',
      detail: 'Planner started processing the request.',
      at: new Date().toISOString(),
      payload: {
        node_id: 'planner',
        next_node_id: 'executor',
        node_kind: 'agent',
        agent_id: 'planner-agent',
        agent_name: 'Planner',
        input: dto.userInput,
      },
    });

    await delay(500);

    hooks.onTrace?.({
      type: 'node_completed',
      title: 'Executor Completed',
      detail: 'Executor generated a simulated answer.',
      at: new Date().toISOString(),
      payload: {
        node_id: 'executor',
        next_node_id: 'final',
        node_kind: 'agent',
        agent_id: 'executor-agent',
        agent_name: 'Executor',
      },
    });

    return {
      assistantMessage: `收到：${dto.userInput}`,
      artifacts: { routeAgentName: 'planner' },
    };
  }
}
```

理解重点：

- `dispatch()` 对应原项目 `_dispatch_run()`。
- `hooks.onTrace()` 对应原项目传入 `_dispatch_run(..., on_event=on_trace)` 的回调。
- `dispatch()` 不知道 SSE、HTTP、Controller，也不应该直接 `response.write()`。
- `dispatch()` 的职责只有两个：执行 workflow；在关键节点报告 Trace。

更完整的假运行顺序可以先设计成：

```text
run_started
node_entered planner
node_exited planner
node_entered executor
node_exited executor
run_finished
final
```

其中 `run_started` 到 `run_finished` 都是 `trace` 事件，`final` 是最终结果事件。

这一步对应当前项目的核心分工：

```text
WorkflowRuntimeService.dispatch()
  产生 TraceEventDto
  返回 RunFinalDto

RunsController.stream()
  把 TraceEventDto 包装成 event: trace
  把 RunFinalDto 包装成 event: final
```


### Step 3：实现 `POST /runs/stream`

Controller 只负责打开流和分发事件：

```ts
@Controller('runs')
export class RunsController {
  constructor(private readonly runtime: WorkflowRuntimeService) {}

  @Post('stream')
  async stream(@Body() dto: RunRequestDto, @Res() res: Response) {
    const events$ = new Subject<MessageEvent>();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const subscription = events$.subscribe({
      next: (event) => {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      },
      complete: () => res.end(),
      error: (error: Error) => {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ message: error.message })}\n\n`);
        res.end();
      },
    });

    res.on('close', () => {
      subscription.unsubscribe();
      events$.complete();
    });

    this.runtime
      .dispatch(dto, {
        onTrace: (trace) => events$.next({ type: 'trace', data: trace }),
      })
      .then((result) => {
        events$.next({ type: 'final', data: result });
        events$.next({ type: 'end', data: {} });
        events$.complete();
      })
      .catch((error: Error) => {
        events$.next({ type: 'error', data: { message: error.message } });
        events$.next({ type: 'end', data: {} });
        events$.complete();
      });
  }
}
```

注意：如果使用 NestJS 的 `@Sse()` 装饰器，通常更适合 `GET` SSE。当前项目是 `POST /runs/stream`，因为前端要提交 `workflowId`、`userInput`、`conversationId` 等 body，所以实战版优先使用 `@Post + @Res()` 手写 SSE header 和 `res.write()`。

## 前端任务

### Step 4：实现 `runStream()`

保留当前项目的思路：

```ts
export async function runStream(
  payload: RunRequestDto,
  handlers: {
    onTrace?: (event: TraceEventDto) => void;
    onFinal?: (event: RunFinalDto) => void;
    onError?: (event: RunErrorDto) => void;
    onEnd?: () => void;
    signal?: AbortSignal;
  },
) {
  const response = await fetch('/runs/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: handlers.signal,
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Streaming body is not available.');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    let splitIndex = buffer.indexOf('\n\n');
    while (splitIndex >= 0) {
      const frame = buffer.slice(0, splitIndex);
      buffer = buffer.slice(splitIndex + 2);
      const parsed = parseSseFrame(frame);

      if (parsed?.event === 'trace') handlers.onTrace?.(parsed.data);
      if (parsed?.event === 'final') handlers.onFinal?.(parsed.data);
      if (parsed?.event === 'error') handlers.onError?.(parsed.data);

      splitIndex = buffer.indexOf('\n\n');
    }
  }

  handlers.onEnd?.();
}
```

### Step 5：Vue 页面验收

页面至少包含：

- 一个输入框：`userInput`
- 一个运行按钮
- 一个停止按钮
- 一个 Trace 列表
- 一个最终回复区域
- 一个 loading/running 状态

验收顺序：

```text
点击运行
  -> loading = true
  -> Trace 列表出现 Planner started
  -> Trace 列表出现 Planner completed
  -> 最终回复出现“收到：xxx”
  -> loading = false
```

## 实战检查点

完成后能回答：

1. `Subject` 在这个 demo 里对应原项目的哪个角色？
2. 为什么 `WorkflowRuntimeService` 不应该直接操作 HTTP response？
3. 为什么前端还需要 `buffer`？
4. 如果后端发送 `error`，前端哪些状态应该变化？

## 当前设计判断

学习者已经指出：`TraceEventDto` 至少要知道当前运行的 agent id、下一步 id，以及节点类型是 agent 还是 skill。这个判断是对的；为了贴近原项目，实战版使用：

- `payload.node_id`：当前节点，用于 Trace 定位和 Graph 高亮。
- `payload.next_node_id`：下一步节点，用于 Graph 边高亮。
- `payload.node_kind`：节点类型，例如 agent、skill、logic、final。
- `payload.agent_id` / `payload.agent_name`：当前 agent 信息。
- `payload.skill_id` / `payload.skill_name`：当事件来自工具或 skill 时使用。

原项目 `TraceEvent` 本体保持通用：`type/title/detail/at/payload`。可视化强依赖的字段放在 `payload` 里。

## 常见错误

- 把所有逻辑写在 Controller 里，导致后续无法扩展 workflow。
- 只返回 final，没有 trace，导致项目退化成普通聊天接口。
- 前端直接 `JSON.parse(chunk)`，忽略 chunk 不等于完整 message。
- 忘记在失败时发送 `end` 或执行 `complete()`，导致前端一直 loading。

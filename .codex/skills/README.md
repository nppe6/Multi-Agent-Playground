# Project Skills

如果这个仓库需要超出全局插件配置之外的项目级 Claude/Codex 本地能力，就把对应 skill 放在这里。

更新这个目录后，执行 `pnpm agent-os:sync`，内容会同步到：

- `.claude/skills/`
- `.codex/skills/`

这些项目级 skills 是脚手架自带的本地兜底能力，不依赖用户提前安装全局 `Compound Engineering` 插件。同步脚本成功结束后，Agent 就可以直接按目录中的 `SKILL.md` 加载对应能力。

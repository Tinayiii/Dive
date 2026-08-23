# Dive

Dive 是一个以真实见面为核心的 Dating 活动产品原型。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开终端输出的本地地址即可体验移动端流程模拟。

## 覆盖流程

- Dating Plan 与活动广场卡片浏览
- Save / No / Apply / Lock fee / Invite
- 我的活动、Host 申请管理与活动修改
- Profile、活动上下文 IM、活动结束后的反馈
- 单人 Date 与 Small Date 的七步创建流程

## 构建

```bash
npm run build
```

## Supabase MVP 后端

项目已经包含 Supabase migration、RLS、seed、AI Edge Function 和前端数据服务层。

1. 创建 Supabase 项目，在 SQL Editor 执行 `supabase/migrations/20260823000000_mvp_schema.sql`。
2. 将 `.env.example` 复制为 `.env.local`，填写项目 URL 和 Publishable Key。
3. Dashboard 中启用 Anonymous Sign-ins，或把 `VITE_SUPABASE_AUTO_ANON` 改为 `false` 后接入邮箱登录。
4. 部署 `ai-create-date` Edge Function，并设置 `AI_MOCK_MODE=true` 先联调。

```bash
supabase functions deploy ai-create-date
supabase secrets set AI_MOCK_MODE=true AI_PROMPT_VERSION=date-create-v3
```

接入真实模型时，将 `AI_MOCK_MODE=false`，并配置 `SILICONFLOW_API_KEY`、`SILICONFLOW_CHAT_MODEL` 和 `SILICONFLOW_IMAGE_MODEL`。创建 Date 的语音按钮使用浏览器 Web Speech API；Chrome / Android Chrome 支持较好，不支持时会自动提示改用文字输入。

配置 Supabase 后，活动读取、收藏、Apply 和发布会写入数据库；未配置时继续使用原型内存数据。完整范围和验收条件见 [Supabase 30 分钟 MVP 后端方案](./docs/dive-supabase-30min-backend-plan.md)。

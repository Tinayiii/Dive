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

## AI 活动创建

活动创建的语音对话与提案生成 Prompt 已版本化在
[`prompts/ai-activity-creation-v3.md`](prompts/ai-activity-creation-v3.md)。它定义了
双人和多人两条独立链路、后端字段状态机、结构化模型输出，以及最终的邀约提案
格式。

当前仓库仍是前端原型：语音识别、字段状态计算与模型调用需要由后端实现。Host
资料已整理为 [`src/data/host-profiles.json`](src/data/host-profiles.json)。它需以
`host_id` 建立明确映射后再接入活动库，不能根据活动序号猜测关联。

## 构建

```bash
npm run build
```

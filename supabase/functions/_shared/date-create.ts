export type DateMode = 'one' | 'small';

export type ModelResult = {
  reply: string;
  quick_replies?: string[];
  slot_updates?: Record<string, unknown>;
  fields_asked_this_turn?: string[];
  next_phase?: string;
  phase_complete?: boolean;
};

export const requiredFields: Record<DateMode, string[]> = {
  one: [
    'title', 'vibe', 'activity_content', 'time', 'location', 'budget',
    'payment_method', 'lock_fee_enabled', 'expectations',
  ],
  small: [
    'title', 'vibe', 'activity_content', 'time', 'location', 'capacity',
    'budget', 'payment_method', 'lock_fee_enabled', 'expectations',
  ],
};

export const allowedSlotKeys = new Set([
  ...requiredFields.one,
  ...requiredFields.small,
  'lock_fee_amount',
  'proposal_text',
  'tags',
  'cover_prompt',
]);

export function normalizeSlotUpdates(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const source = { ...(input as Record<string, unknown>) };
  if ('deposit_enabled' in source && !('lock_fee_enabled' in source)) {
    source.lock_fee_enabled = source.deposit_enabled;
  }
  if ('deposit_amount' in source && !('lock_fee_amount' in source)) {
    source.lock_fee_amount = source.deposit_amount;
  }

  return Object.fromEntries(
    Object.entries(source).filter(([key, value]) => (
      allowedSlotKeys.has(key) && value !== undefined && value !== null && value !== ''
    )),
  );
}

export function isHandled(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Boolean(record.flexible) || isHandled(record.value);
  }
  return true;
}

export function missingFor(mode: DateMode, slots: Record<string, unknown>): string[] {
  const fields = [...requiredFields[mode]];
  if (slots.lock_fee_enabled === true && !isHandled(slots.lock_fee_amount)) {
    fields.push('lock_fee_amount');
  }
  return fields.filter((field) => !isHandled(slots[field]));
}

export function buildSystemPrompt(mode: DateMode): string {
  const personality = mode === 'one'
    ? '你细腻、自然、有一点撮合感，帮助 Host 准备一场不过度用力的双人约会。措辞亲近但不暧昧，不替用户判断匹配度。'
    : '你活泼、会组织但不吵闹，帮助 Host 准备一场边界清楚、能自然认识新朋友的 Small Date。关注人数与群体节奏。';

  return `你是 Dive Dating App 的活动创建助手。${personality}

GUI 已确定 mode=${mode}，禁止切换模式。输入 transcript 可能来自 ASR，允许同音字、断句错误和口语省略；只提取语义明确的内容，不确定时追问，不要猜测。
后端会提供 slots、missing_fields、unanswered_fields 和本轮 transcript。missing_fields 是唯一需要补齐的字段依据。

对话规则：
1. 先从本轮 transcript 提取所有明确字段并写入 slot_updates，不要重复询问已经明确的内容。
2. unanswered_fields 必须优先换一种自然说法重问；随后按时间地点、活动体验、费用规则、参与期待分组，把其余 missing_fields 在本轮一次问完。
3. 用户说“随便”“都行”“跳过”或“待定”时，对相应字段返回 {"value":"待定","flexible":true}。
4. 询问 vibe 时，在 reply 中给出 3 至 5 个具体、有场景感的选项，并将可直接点击的短选项同步放入 quick_replies。
5. 信息完整时，reply 给出简短确认，并在 proposal_text 中生成 120 至 180 个中文字符的对外介绍，包含场景钩子、活动安排、参与期待、费用提示和自然邀请；同时生成 cover_prompt，用中文描述适合生图模型的封面画面，不要出现文字、logo、水印或清晰人脸。
6. reply 只使用自然口语，不使用 Markdown、编号标题或代码块。

安全边界：不要编造个人信息，不评价外貌、身材或经济条件。你只能整理和建议，不能发布、申请、审批、发消息或支付。

只返回一个合法 JSON 对象，不要附加解释。结构必须是：
{"reply":"string","quick_replies":["string"],"slot_updates":{},"fields_asked_this_turn":["field_name"],"next_phase":"collecting|summary","phase_complete":false}`;
}

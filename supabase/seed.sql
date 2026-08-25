-- Seed rows are inserted only after matching Auth users have a profile legacy_key.
-- Set legacy_key to 'vivi' or 'lin' on local test profiles, then rerun this file.

insert into public.dates (
  host_id, legacy_key, mode, title, activity_content, description, vibe,
  time_text, area_text, budget_amount, payment_method, lock_fee_enabled,
  lock_fee_amount, expectations, capacity, visibility, status
)
select
  p.id,
  'seed-books',
  'one',
  '周六傍晚，一起逛独立书店',
  '从一家独立书店挑一本到附近咖啡馆慢慢聊。',
  '不赶行程，想认识一个愿意分享最近在读什么的人。',
  array['松弛', '有点好奇'],
  '本周六 16:00',
  '静安寺附近',
  8000,
  'AA',
  true,
  3000,
  '愿意慢慢聊天，也可以安静翻书。',
  2,
  'public',
  'recruiting'
from public.profiles p
where p.legacy_key = 'lin'
on conflict (legacy_key) do nothing;

insert into public.dates (
  host_id, legacy_key, mode, title, activity_content, description, vibe,
  time_text, area_text, budget_amount, payment_method, lock_fee_enabled,
  lock_fee_amount, expectations, capacity, visibility, status
)
select
  p.id,
  'seed-flowers',
  'small',
  '午后的手作花束与一杯咖啡',
  '在花店做一束不需要很完美的花，再到隔壁喝咖啡。',
  '想约一小群愿意边做边聊的人。',
  array['温柔', '一起动手'],
  '下周日 14:30',
  '徐汇区',
  16000,
  '各自支付',
  true,
  5000,
  '对陌生人保持善意，愿意把手机放下来一会儿。',
  4,
  'public',
  'recruiting'
from public.profiles p
where p.legacy_key = 'vivi'
on conflict (legacy_key) do nothing;

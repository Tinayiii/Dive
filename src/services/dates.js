import { requireSupabase } from '../lib/supabase.js';

const statusToUi = {
  recruiting: '招募中',
  full: '已 Lock',
  completed: '已结束',
  cancelled: '已取消',
  draft: '草稿',
};

function mapHost(row) {
  const profile = Array.isArray(row.host) ? row.host[0] : row.host;
  return {
    id: profile?.legacy_key || row.host_id,
    userId: row.host_id,
    name: profile?.display_name || 'Dive Host',
    city: profile?.city || '',
    age: profile?.age,
    intro: profile?.intro || '',
    interests: profile?.interests || [],
  };
}

export function mapDateRow(row) {
  const host = mapHost(row);
  return {
    id: row.id,
    host: host.id,
    hostUserId: host.userId,
    hostProfile: host,
    mode: row.mode,
    title: row.title,
    cover: 'custom',
    vibe: row.vibe || [],
    content: row.activity_content,
    description: row.description,
    time: row.time_text,
    location: row.area_text,
    exact: 'Lock 后开放',
    budget: Math.round((row.budget_amount || 0) / 100),
    payment: row.payment_method,
    lockFee: Math.round((row.lock_fee_amount || 0) / 100),
    lockFeeEnabled: row.lock_fee_enabled,
    expectation: row.expectations,
    capacity: row.capacity,
    coverPrompt: row.cover_prompt,
    coverImage: row.cover_image_url,
    attendees: [],
    status: statusToUi[row.status] || row.status,
    visibility: row.visibility === 'public' ? '公开' : '私密',
    aiProposalText: row.ai_proposal_text,
    tags: row.ai_tags || [],
    backend: true,
  };
}

export async function listDates() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('dates')
    .select(`
      id, host_id, mode, title, activity_content, description, vibe,
      time_text, area_text, budget_amount, currency, payment_method,
      lock_fee_enabled, lock_fee_amount, expectations, capacity,
      cover_prompt, cover_image_url, visibility, status,
      ai_proposal_text, ai_tags, created_at,
      host:profiles!dates_host_id_fkey(
        legacy_key, display_name, city, age, intro, interests
      )
    `)
    .in('status', ['recruiting', 'full', 'completed'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapDateRow);
}

export async function createDate(userId, draft) {
  const client = requireSupabase();
  const payload = {
    host_id: userId,
    mode: draft.mode,
    title: draft.title.trim(),
    activity_content: draft.content.trim(),
    description: draft.description.trim(),
    vibe: draft.vibe,
    time_text: draft.time.trim(),
    area_text: draft.location.trim(),
    budget_amount: Math.round(Number(draft.budget) * 100),
    payment_method: draft.payment,
    lock_fee_enabled: Boolean(draft.lockFeeEnabled),
    lock_fee_amount: draft.lockFeeEnabled ? Math.round(Number(draft.fee) * 100) : 0,
    expectations: draft.expectation.trim(),
    capacity: Number(draft.capacity),
    cover_prompt: draft.coverPrompt || null,
    cover_image_url: draft.coverImage || null,
    visibility: draft.visibility === '公开' ? 'public' : 'private',
    status: 'recruiting',
  };
  const { data, error } = await client
    .from('dates')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return mapDateRow(data);
}

export async function listSavedDateIds(userId) {
  const { data, error } = await requireSupabase()
    .from('saved_dates')
    .select('date_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((row) => row.date_id);
}

export async function setDateSaved(userId, dateId, saved) {
  const query = requireSupabase().from('saved_dates');
  const { error } = saved
    ? await query.upsert({ user_id: userId, date_id: dateId })
    : await query.delete().eq('user_id', userId).eq('date_id', dateId);
  if (error) throw error;
}

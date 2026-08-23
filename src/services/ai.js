import { requireSupabase } from '../lib/supabase.js';

export async function continueDateCreation({ sessionId, mode, transcript, inputRevision = 1 }) {
  const { data, error } = await requireSupabase().functions.invoke('ai-create-date', {
    body: {
      session_id: sessionId || null,
      mode,
      transcript,
      input_revision: inputRevision,
    },
  });
  if (error) {
    let details;
    try {
      details = await error.context?.json();
    } catch {
      details = null;
    }
    throw new Error(details?.error?.message || error.message || 'AI 创建服务调用失败');
  }
  if (data?.error) throw new Error(data.error.message || data.error.code);
  return data;
}

export async function generateDateCover({ mode, title, content, vibe = [], location, capacity }) {
  const { data, error } = await requireSupabase().functions.invoke('ai-create-date', {
    body: {
      task: 'generate_cover',
      mode,
      slots: {
        title,
        activity_content: content,
        vibe,
        location,
        capacity,
      },
    },
  });
  if (error) {
    let details;
    try {
      details = await error.context?.json();
    } catch {
      details = null;
    }
    throw new Error(details?.error?.message || error.message || 'AI 图片生成服务调用失败');
  }
  if (data?.error) throw new Error(data.error.message || data.error.code);
  return data;
}

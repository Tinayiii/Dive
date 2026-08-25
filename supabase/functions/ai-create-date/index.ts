import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  buildSystemPrompt,
  missingFor,
  normalizeSlotUpdates,
} from '../_shared/date-create.ts';
import type { DateMode, ModelResult } from '../_shared/date-create.ts';

type RequestBody = {
  task?: 'continue' | 'generate_cover';
  session_id?: string | null;
  mode?: DateMode;
  transcript?: string;
  input_revision?: number;
  slots?: Record<string, unknown>;
};

type AiSession = {
  id: string;
  user_id: string;
  mode: DateMode;
  slots: Record<string, unknown>;
  missing_fields: string[];
  last_fields_asked: string[];
  unanswered_counts: Record<string, number>;
  phase: string;
  input_revision: number;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function error(code: string, message: string, status = 400): Response {
  return response({ error: { code, message } }, status);
}

function mockModel(mode: DateMode, transcript: string, missing: string[]): ModelResult {
  const slotUpdates: Record<string, unknown> = {};
  const budget = transcript.match(/(?:预算|人均)[^0-9]{0,4}(\d{2,5})/);
  if (budget) slotUpdates.budget = Number(budget[1]);
  if (/AA|aa/.test(transcript)) slotUpdates.payment_method = 'AA';
  if (/不收(?:押金|lock fee)|不要(?:押金|lock fee)/i.test(transcript)) {
    slotUpdates.lock_fee_enabled = false;
  }
  if (/周[一二三四五六日天]|今晚|明天|下午|晚上|周末/.test(transcript)) {
    slotUpdates.time = transcript;
  }
  if (/书店/.test(transcript)) slotUpdates.activity_content = '逛书店并找地方聊天';
  if (/陶艺/.test(transcript)) slotUpdates.activity_content = '一起做陶艺';
  if (mode === 'small') {
    const capacity = transcript.match(/([3-5])\s*个人/);
    if (capacity) slotUpdates.capacity = Number(capacity[1]);
  }

  const asked = missing.filter((field) => !(field in slotUpdates));
  return {
    reply: asked.length
      ? `我先记下了。再补充一下${asked.join('、')}，说随便或待定也可以。`
      : '信息已经齐了，我来为你整理一份完整的 Date 提案。',
    quick_replies: ['都可以', '先标待定', '继续补充'],
    slot_updates: slotUpdates,
    fields_asked_this_turn: asked,
    next_phase: asked.length ? 'collecting' : 'summary',
    phase_complete: asked.length === 0,
  };
}

function parseModelJson(content: string): ModelResult {
  const normalized = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(normalized);
  if (!parsed || typeof parsed !== 'object' || typeof parsed.reply !== 'string') {
    throw new Error('Model response does not match the required schema');
  }
  return parsed as ModelResult;
}

function textFromSlot(slots: Record<string, unknown>, key: string): string {
  const value = slots[key];
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return String((value as Record<string, unknown>).value ?? '').trim();
  }
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join('、');
  return String(value ?? '').trim();
}

function buildCoverPrompt(mode: DateMode, slots: Record<string, unknown>): string {
  const title = textFromSlot(slots, 'title') || '一场具体的 Date';
  const content = textFromSlot(slots, 'activity_content');
  const vibe = textFromSlot(slots, 'vibe') || '松弛、有真实感';
  const location = textFromSlot(slots, 'location');
  const capacity = Number(textFromSlot(slots, 'capacity')) || (mode === 'small' ? 4 : 2);
  const people = mode === 'one'
    ? 'two people on a date, no visible faces, natural distance'
    : `${capacity} people in a small social date, no visible faces, natural group rhythm`;

  return [
    'Create a polished editorial cover image for a dating app activity card.',
    `Activity title: ${title}.`,
    content ? `Scene: ${content}.` : '',
    location ? `Location mood: ${location}.` : '',
    `Mood keywords: ${vibe}.`,
    people,
    'Photorealistic lifestyle photography, warm natural light, cinematic but not dark, tasteful, safe public setting, no text, no logo, no watermark, no close-up faces.',
    'Aspect ratio 4:5, mobile card cover composition with clear subject and space for UI overlay.',
  ].filter(Boolean).join(' ');
}

async function callImageModel(mode: DateMode, slots: Record<string, unknown>): Promise<{
  cover_prompt: string;
  cover_image_url: string;
  model: string;
  mock: boolean;
}> {
  const coverPrompt = buildCoverPrompt(mode, slots);
  const mockMode = (Deno.env.get('AI_MOCK_MODE') ?? 'true') !== 'false';
  if (mockMode) {
    return {
      cover_prompt: coverPrompt,
      cover_image_url: mode === 'one' ? '/date-plan-assets/date-plan-one.png' : '/date-plan-assets/date-plan-small.png',
      model: 'mock-cover',
      mock: true,
    };
  }

  const apiKey = Deno.env.get('SILICONFLOW_API_KEY');
  if (!apiKey) throw new Error('SILICONFLOW_API_KEY is not configured');

  const baseUrl = Deno.env.get('SILICONFLOW_BASE_URL') ?? 'https://api.siliconflow.cn/v1';
  const imageModel = Deno.env.get('SILICONFLOW_IMAGE_MODEL');
  if (!imageModel) throw new Error('SILICONFLOW_IMAGE_MODEL is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let providerResponse: Response;
  try {
    providerResponse = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: imageModel,
        prompt: coverPrompt,
        n: 1,
        size: Deno.env.get('SILICONFLOW_IMAGE_SIZE') ?? '1024x1280',
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!providerResponse.ok) {
    throw new Error(`Image provider returned ${providerResponse.status}`);
  }

  const payload = await providerResponse.json() as {
    data?: Array<{ url?: string; b64_json?: string }>;
  };
  const first = payload.data?.[0];
  const coverImageUrl = first?.url || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : '');
  if (!coverImageUrl) throw new Error('Image provider returned no image');

  return {
    cover_prompt: coverPrompt,
    cover_image_url: coverImageUrl,
    model: imageModel,
    mock: false,
  };
}

async function callModel(
  mode: DateMode,
  transcript: string,
  session: AiSession,
  missing: string[],
): Promise<ModelResult> {
  const mockMode = (Deno.env.get('AI_MOCK_MODE') ?? 'true') !== 'false';
  if (mockMode) return mockModel(mode, transcript, missing);

  const apiKey = Deno.env.get('SILICONFLOW_API_KEY');
  if (!apiKey) throw new Error('SILICONFLOW_API_KEY is not configured');

  const baseUrl = Deno.env.get('SILICONFLOW_BASE_URL') ?? 'https://api.siliconflow.cn/v1';
  const model = Deno.env.get('SILICONFLOW_CHAT_MODEL');
  if (!model) throw new Error('SILICONFLOW_CHAT_MODEL is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let providerResponse: Response;
  try {
    providerResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt(mode) },
          {
            role: 'user',
            content: JSON.stringify({
              slots: session.slots,
              missing_fields: missing,
              unanswered_fields: Object.entries(session.unanswered_counts)
                .filter(([, count]) => count > 0)
                .map(([field]) => field),
              transcript,
            }),
          },
        ],
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!providerResponse.ok) {
    throw new Error(`AI provider returned ${providerResponse.status}`);
  }

  const payload = await providerResponse.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return parseModelJson(payload?.choices?.[0]?.message?.content ?? '');
}

function getPublishableKey(): string | undefined {
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacyKey) return legacyKey;

  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    return Object.values(keys).find((value): value is string => typeof value === 'string');
  } catch {
    return undefined;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return error('METHOD_NOT_ALLOWED', 'Only POST is supported', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = getPublishableKey();
  const authHeader = request.headers.get('Authorization');
  if (!supabaseUrl || !publishableKey) {
    return error('SERVER_CONFIG_ERROR', 'Supabase environment is incomplete', 500);
  }
  if (!authHeader) return error('AUTH_REQUIRED', 'Sign in before using AI creation', 401);

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return error('AUTH_INVALID', 'Session is invalid', 401);

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Request body must be valid JSON');
  }

  const mode = body.mode;
  if (mode !== 'one' && mode !== 'small') return error('INVALID_MODE', 'Mode must be one or small');

  if (body.task === 'generate_cover') {
    const slots = normalizeSlotUpdates(body.slots ?? {});
    try {
      const image = await callImageModel(mode, slots);
      return response({
        ...image,
        prompt_version: Deno.env.get('AI_PROMPT_VERSION') ?? 'date-create-v3',
      });
    } catch (imageError) {
      console.error('ai-create-date image provider error', imageError);
      return error('AI_IMAGE_PROVIDER_FAILED', 'AI image generation is temporarily unavailable', 502);
    }
  }

  const transcript = body.transcript?.trim();
  const inputRevision = body.input_revision ?? 1;
  if (!transcript || transcript.length > 5000) {
    return error('INVALID_TRANSCRIPT', 'Transcript must contain 1 to 5000 characters');
  }
  if (!Number.isInteger(inputRevision) || inputRevision < 1) {
    return error('INVALID_REVISION', 'input_revision must be a positive integer');
  }

  let session: AiSession;
  if (body.session_id) {
    const { data, error: selectError } = await supabase
      .from('ai_sessions')
      .select('*')
      .eq('id', body.session_id)
      .single();
    if (selectError || !data) return error('AI_SESSION_NOT_FOUND', 'AI session was not found', 404);
    session = data as AiSession;
    if (session.mode !== mode) return error('AI_SESSION_MODE_CONFLICT', 'Session mode cannot be changed', 409);
    if (session.input_revision !== inputRevision) {
      return error('AI_SESSION_REVISION_CONFLICT', 'Refresh the session before continuing', 409);
    }
  } else {
    const initialMissing = missingFor(mode, {});
    const { data, error: insertError } = await supabase
      .from('ai_sessions')
      .insert({
        user_id: userData.user.id,
        mode,
        missing_fields: initialMissing,
        input_revision: inputRevision,
      })
      .select('*')
      .single();
    if (insertError || !data) return error('AI_SESSION_CREATE_FAILED', insertError?.message ?? 'Create failed', 500);
    session = data as AiSession;
  }

  let modelResult: ModelResult;
  try {
    modelResult = await callModel(mode, transcript, session, session.missing_fields);
  } catch (modelError) {
    console.error('ai-create-date provider error', modelError);
    return error('AI_PROVIDER_FAILED', 'AI is temporarily unavailable; manual creation still works', 502);
  }

  const slotUpdates = normalizeSlotUpdates(modelResult.slot_updates);
  const slots = { ...session.slots, ...slotUpdates };
  const unansweredCounts = { ...session.unanswered_counts };

  for (const field of session.last_fields_asked ?? []) {
    if (field in slotUpdates) {
      delete unansweredCounts[field];
      continue;
    }
    unansweredCounts[field] = (unansweredCounts[field] ?? 0) + 1;
    if (unansweredCounts[field] >= 3) {
      slots[field] = { value: '待定', flexible: true };
      delete unansweredCounts[field];
    }
  }

  const missingFields = missingFor(mode, slots);
  const fieldsAsked = Array.isArray(modelResult.fields_asked_this_turn)
    ? modelResult.fields_asked_this_turn.filter((field) => missingFields.includes(field))
    : [];
  const nextRevision = inputRevision + 1;
  const phase = missingFields.length === 0 ? 'summary' : 'collecting';

  const { error: messageError } = await supabase.from('ai_messages').insert([
    { session_id: session.id, role: 'user', transcript, payload: {} },
    {
      session_id: session.id,
      role: 'assistant',
      payload: { ...modelResult, slot_updates: slotUpdates },
    },
  ]);
  if (messageError) return error('AI_MESSAGE_SAVE_FAILED', messageError.message, 500);

  const { error: updateError } = await supabase
    .from('ai_sessions')
    .update({
      slots,
      missing_fields: missingFields,
      last_fields_asked: fieldsAsked,
      unanswered_counts: unansweredCounts,
      phase,
      input_revision: nextRevision,
    })
    .eq('id', session.id);
  if (updateError) return error('AI_SESSION_SAVE_FAILED', updateError.message, 500);

  return response({
    session_id: session.id,
    reply: modelResult.reply,
    quick_replies: modelResult.quick_replies ?? [],
    slot_updates: slotUpdates,
    fields_asked_this_turn: fieldsAsked,
    missing_fields_remaining: missingFields,
    next_phase: phase,
    phase_complete: missingFields.length === 0,
    input_revision: nextRevision,
    prompt_version: Deno.env.get('AI_PROMPT_VERSION') ?? 'date-create-v3',
  });
});

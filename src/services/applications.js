import { requireSupabase } from '../lib/supabase.js';

const statusToUi = {
  applied: '申请中',
  approved_pending_lock: '待支付 Lock fee',
  locked: '已 Lock',
  rejected: '已拒绝',
  withdrawn: '已撤回',
};

function mapApplication(row) {
  const applicant = Array.isArray(row.applicant) ? row.applicant[0] : row.applicant;
  return {
    id: row.id,
    dateId: row.date_id,
    user: applicant?.legacy_key || row.applicant_id,
    applicantUserId: row.applicant_id,
    applicantProfile: applicant || null,
    status: statusToUi[row.status] || row.status,
    note: row.note,
    backend: true,
  };
}

export async function listApplications() {
  const { data, error } = await requireSupabase()
    .from('applications')
    .select(`
      id, date_id, applicant_id, status, note, created_at,
      applicant:profiles!applications_applicant_id_fkey(
        legacy_key, display_name, city, age, intro, interests
      )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapApplication);
}

export async function applyToDate(userId, dateId, note) {
  const { data, error } = await requireSupabase()
    .from('applications')
    .insert({ applicant_id: userId, date_id: dateId, note: note.trim() })
    .select('*')
    .single();
  if (error) throw error;
  return mapApplication(data);
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityGaugeLg, ActivityGaugeXs } from './components/untitled/application/charts/activity-gauges.jsx';
import jsonActivities from './data/activities.json';
import profileRecords from './data/profiles.json';
import { isSupabaseConfigured } from './lib/supabase.js';
import { ensureDemoSession, getSession } from './services/auth.js';
import { applyToDate, listApplications } from './services/applications.js';
import { continueDateCreation, generateDateCover } from './services/ai.js';
import { createDate, listDates, listSavedDateIds, setDateSaved } from './services/dates.js';

const modeName = { one: '1v1 Date', small: 'Small Date' };

const seedDates = [
  {
    id: 'd1', host: 'lin', mode: 'one', title: '周六傍晚，一起逛独立书店', cover: 'books', vibe: ['松弛', '有点好奇'],
    content: '从一家独立书店挑一本到附近咖啡馆慢慢聊。', description: '不赶行程，想认识一个愿意分享最近在读什么的人。', time: '本周六 16:00', location: '静安寺附近', exact: '愚园路 1388 号 · 书店门口', budget: 80, payment: 'AA', lockFee: 30, refund: '活动开始前 24 小时可退', expectation: '愿意慢慢聊天，也可以安静翻书。', capacity: 2, attendees: [], status: '招募中'
  },
  {
    id: 'd2', host: 'vivi', mode: 'small', title: '午后的手作花束与一杯咖啡', cover: 'flowers', vibe: ['温柔', '一起动手'],
    content: '在花店做一束不需要很完美的花，再到隔壁喝咖啡。', description: '想约一小群愿意边做边聊的人，结束前可以交换一张喜欢的照片。', time: '下周日 14:30', location: '徐汇区', exact: '安福路 277 号 · 花艺工作室', budget: 160, payment: '各自支付', lockFee: 50, refund: '活动开始前 24 小时可退', expectation: '对陌生人保持善意，愿意把手机放下来一会儿。', capacity: 4, attendees: ['ren', 'nora'], status: '招募中', rhythm: '轻松聊天', icebreaker: '带一张最近让你心动的照片。'
  },
  {
    id: 'd3', host: 'yoyo', mode: 'small', title: '傍晚散步，去看一场小型摄影展', cover: 'photo', vibe: ['城市漫游', '慢慢认识'],
    content: '先在展馆门口集合，看完展沿街散步，再去喝一杯。', description: '适合想在具体场景里认识人的你。', time: '本周日 16:00', location: '黄浦区', exact: '复兴中路 1363 号 · 摄影展入口', budget: 120, payment: 'AA', lockFee: 40, refund: '活动开始前 12 小时可退', expectation: '愿意分享一张最近拍下的照片。', capacity: 4, attendees: ['vivi', 'ming'], status: '已 Lock', rhythm: '有主题流程', icebreaker: '分享一张最近拍的照片。'
  },
  {
    id: 'd4', host: 'jun', mode: 'one', title: '在雨后的唱片店挑一张唱片', cover: 'vinyl', vibe: ['有点浪漫', '不赶时间'],
    content: '一起选唱片，再找一家小店吃晚饭。', description: '上周的 Date 已结束。', time: '上周六 18:00', location: '长宁区', exact: '定西路 799 号', budget: 150, payment: 'AA', lockFee: 0, refund: '', expectation: '可以聊音乐，也可以只是安静听歌。', capacity: 2, attendees: ['vivi'], status: '已结束'
  },
  {
    id: 'd5', host: 'lin', mode: 'one', title: '旧电影放映与深夜热巧克力', cover: 'cinema', vibe: ['电影', '夜晚'],
    content: '看完老电影去附近喝一杯热巧。', description: '收藏示例：已过期。', time: '8 月 6 日 19:00', location: '静安区', exact: '', budget: 100, payment: 'AA', lockFee: 0, refund: '', expectation: '喜欢电影。', capacity: 2, attendees: [], status: '已结束', expired: true
  }
];

const people = {
  vivi: { name: 'Vivi', age: 27, city: '上海', avatar: 'V', intent: '想认识一个特别的人', intro: '喜欢把周末过成一张小小的邀请函。', interests: ['独立电影', '散步', '烘焙'] },
  lin: { name: '林', age: 29, city: '上海', avatar: '林', intent: '认真恋爱', intro: '慢热，但会认真听你讲喜欢的事情。', interests: ['书店', '建筑', '爵士'] },
  yoyo: { name: 'Yoyo', age: 28, city: '上海', avatar: 'Y', intent: '先一起出去玩', intro: '在城市里收集好吃的面包和好故事。', interests: ['烘焙', '城市散步', '摄影'] },
  jun: { name: 'Jun', age: 30, city: '上海', avatar: 'J', intent: '顺其自然看感觉', intro: '想从一顿好饭开始，慢慢认识彼此。', interests: ['料理', '黑胶', '旅行'] },
  ren: { name: '任远', age: 28, city: '上海', avatar: '任', intent: '想认识一个特别的人', intro: '喜欢把一小时的散步聊成半天。', interests: ['展览', '徒步', '咖啡'] },
  nora: { name: 'Nora', age: 26, city: '上海', avatar: 'N', intent: '先一起出去玩', intro: '有趣的展览，值得再看一遍。', interests: ['电影', '设计', '爵士'] },
  ming: { name: '明', age: 27, city: '上海', avatar: '明', intent: '顺其自然看感觉', intro: '周末在公园和工作室之间切换。', interests: ['插花', '市集'] }
};

/* ── JSON 活动库接入 ── */
const coverByCategory = { '私人据点':'custom', '小众节庆':'photo', '非常时段':'cinema', '幕后访问':'custom', '技能交换':'flowers', '城市探索':'photo', '圈层文化':'vinyl', '即兴冒险':'custom' };
const parseBudget = (str) => { const match = String(str).match(/(\d+)/); return match ? Number(match[1]) : 0; };
const statusMap = { '招募中':'招募中', '已满':'已 Lock', '已结束':'已结束' };
const profileKey = (id) => `profile-${id}`;
const sortedProfileRecords = [...profileRecords].sort((a, b) => Number(a.id) - Number(b.id));
const profileRecordById = Object.fromEntries(sortedProfileRecords.map((profile) => [String(profile.id), profile]));
const profileImage = (profile) => `/profile-avatars/${profile.avatarUrl.split('/').at(-1)}`;

sortedProfileRecords.forEach((profile) => {
  people[profileKey(profile.id)] = {
    name: profile.name,
    age: Number(profile.age),
    city: profile.city,
    avatar: profile.name.charAt(0),
    avatarImage: profileImage(profile),
    gender: profile.gender,
    intent: profile.datingIntent,
    intro: profile.moment,
    interests: profile.tags || [],
    height: `${profile.heightCm}cm`,
    education: profile.education,
    work: profile.job,
    mbti: profile.mbti,
    datingStyle: profile.datingStyle,
    availability: profile.availableTime,
  };
});

function stableParticipants(activityId, capacity) {
  const maximum = Math.min(3, Math.max(1, Number(capacity || 2) - 1));
  const count = 1 + ((Number(activityId) * 7) % maximum);
  const hostIndex = Number(activityId) - 1;
  return Array.from({ length:count }, (_, offset) => {
    const index = (hostIndex + 7 + (offset * 13)) % sortedProfileRecords.length;
    return profileKey(sortedProfileRecords[index].id);
  }).filter((id) => id !== profileKey(activityId));
}

const jsonDates = jsonActivities.map((item) => {
  const hostProfile = profileRecordById[String(item.id)];
  const isSmall = item.activity_type !== '双人';
  return { id:`j${item.id}`, source:'library', activityId:item.id, host:profileKey(item.id), hostImage:hostProfile ? profileImage(hostProfile) : '', mode:isSmall ? 'small' : 'one', title:item.title, cover:coverByCategory[item['活动类别']] || 'custom', coverImage:item.cover_image, vibe:item.vibe || [], content:item.activity_content, description:item.description, time:item.time, location:item.location, exact:item.location, budget:parseBudget(item.budget), budgetText:item.budget, payment:item.payment_method || 'AA', lockFee:item.deposit_enabled ? (item.deposit_amount || 0) : 0, refund:'活动开始前 24 小时可退', expectation:item.expectations || '', capacity:item.capacity || 2, attendees:isSmall ? stableParticipants(item.id, item.capacity) : [], status:statusMap[item.status] || '招募中', category:item.category, activityCategory:item['活动类别'], tags:item.tags || [], hostNote:item.host_note, applicants:item.applicants || 0, matchedAttendees:item.matched_attendees || 0, rsvpDeadline:item.rsvp_deadline, ageRange:item.age_range, dressCode:item.dress_code };
});
const stableDateShuffle = (items) => [...items].sort((a, b) => ((Number(a.activityId) * 37) % 101) - ((Number(b.activityId) * 37) % 101));
const recruitingWomen = stableDateShuffle(jsonDates.filter((date) => date.status === '招募中' && people[date.host]?.gender === '女'));
const recruitingMen = stableDateShuffle(jsonDates.filter((date) => date.status === '招募中' && people[date.host]?.gender === '男'));
const balancedFeedOrder = [];
for (let index = 0; index < Math.max(recruitingWomen.length, recruitingMen.length); index += 1) {
  if (recruitingWomen[index]) balancedFeedOrder.push(recruitingWomen[index]);
  if (recruitingMen[index]) balancedFeedOrder.push(recruitingMen[index]);
}
const balancedFeedRank = Object.fromEntries(balancedFeedOrder.map((date, index) => [date.id, index]));
const seedDatesAll = [...seedDates, ...jsonDates];

const profileSeed = (id) => {
  const person = people[id];
  const isVivi = id === 'vivi';
  return {
    handle: `@${person.name.toLowerCase().replaceAll(' ', '_')}`,
    name: person.name,
    age: person.age,
    city: person.city,
    intro: person.intro,
    photos: person.avatarImage ? [person.avatarImage] : ['portrait', 'coffee', 'city'],
    height: person.height || (isVivi ? '165cm' : '175cm'),
    zodiac: isVivi ? '双鱼座' : '狮子座',
    education: person.education || (isVivi ? '本科' : '硕士'),
    work: person.work || (isVivi ? '产品经理' : '设计师'),
    income: '',
    tags: isVivi ? ['慢热', '浪漫主义', '喜欢深聊'] : person.interests.slice(0, 3),
    intent: person.intent,
    mbti: person.mbti || (isVivi ? 'ENFP' : 'INFJ'),
    styles: isVivi ? [{ icon:'🐢', title:'慢慢熟型', copy:'熟起来之后会完全不一样。' }, { icon:'🎈', title:'一起玩再说', copy:'比起采访彼此，更喜欢一起做点什么。' }] : [{ icon:'☁️', title:person.datingStyle || '慢慢认识', copy:'先从一场具体的 Date 开始。' }],
    activities: person.interests,
    peoplePreference: '1v1 与 Small Date 都可以',
    availability: person.availability ? [person.availability] : ['周六下午', '周日傍晚'],
    voice: isVivi ? '0:16' : '',
    moments: isVivi ? [{ photo:'moment-surf', copy:'第一次学冲浪，站起来三秒。' }, { photo:'moment-shop', copy:'周末随机钻进一家没去过的店。' }] : [],
    privacy: { visibility:'all', work:true, income:false, stats:true, history:false },
    notificationSettings: { message:true, hostReply:true, application:true, confirmation:true, reminder:true, change:true, feedback:true }
  };
};
const initialProfiles = Object.fromEntries(Object.keys(people).map((id) => [id, profileSeed(id)]));

const initialApplications = [
  { id: 'a1', dateId: 'd2', user: 'ming', status: '待处理', note: '我会带一张最近在城市里拍的照片。' }
];

const initialChats = [
  { id: 'c1', type: 'person', with: 'lin', dateIds: ['d1'], contextDateId:'d1', pinned:true, unread:2, updatedAt:300, messages: [{ mine: false, type:'text', text: '如果你对书店的节奏有想问的，随时问我。', time:'18:02', reactions:[{ emoji:'💜', count:1, mine:true }] }, { mine: false, type:'text', text:'书店见面后可以一起去喝咖啡。', time:'18:04', reactions:[{ emoji:'✨', count:2, mine:false }] }] },
  { id: 'c2', type: 'group', name: '摄影展 · 活动群', with: 'yoyo', dateIds: ['d3'], contextDateId:'d3', pinned:false, unread:0, updatedAt:210, messages: [{ mine: false, type:'text', text: '明天见！我会在入口拿着蓝色相机带。', time:'昨天' }] },
  { id: 'c3', type: 'person', with: 'ren', dateIds: ['d2','d3'], contextDateId:'d2', pinned:false, unread:1, updatedAt:180, messages: [{ mine: true, type:'text', text:'这个活动还可以带朋友吗？', time:'16:20' }, { mine: false, type:'text', text:'可以呀，不过请先和我说一声。', time:'16:24' }] },
  { id: 'c4', type: 'person', with: 'jun', dateIds: ['d4'], contextDateId:'d4', pinned:false, unread:0, updatedAt:90, messages: [{ mine: true, type:'text', text:'上次的唱片店让我想再去一次。', time:'周一' }] }
];

const makeCreateDraft = () => ({
  mode: 'one', title: '周末一起去看一场小展', content: '从展览开始，结束后找一家安静的咖啡店坐坐。',
  time: '下周六 15:00', timeFlexible: true, location: '上海市中心', locationFlexible: true, exact: '',
  budget: 100, budgetScope: '人均', payment: 'AA', lockFeeEnabled: true, fee: 30,
  refundPolicy: '活动开始前 24 小时可退', description: '想认识一个愿意在具体场景里慢慢聊天的人。',
  expectation: '愿意交流，也尊重彼此不说话的时刻。', vibe: ['松弛'], capacity: 2, visibility: '公开',
  coverPrompt: '', coverImage: '',
  groupRhythm: '轻松聊天', icebreaker: '轻量即可', selectionRule: 'Host 审核', groupChatRule: '全部 Lock 后自动建群',
  confirmationTiming: '报名截止后 12 小时内确认', exitPolicy: '需要提前离开可以告诉 Host，安全永远优先。',
  hostProfileFields: ['城市', 'Dating intent', '兴趣', '一句自我介绍']
});

function extractKeywords(text) {
  const dict = [
    { word:'书店', tags:['阅读','安静'] }, { word:'咖啡', tags:['咖啡','闲聊'] }, { word:'展览', tags:['艺术','城市'] },
    { word:'看展', tags:['艺术','城市'] }, { word:'电影', tags:['电影','夜晚'] }, { word:'唱片', tags:['音乐','复古'] },
    { word:'手作', tags:['动手','创作'] }, { word:'陶艺', tags:['动手','创作'] }, { word:'花束', tags:['自然','温柔'] },
    { word:'散步', tags:['户外','漫游'] }, { word:'户外', tags:['户外','自然'] }, { word:'小酒馆', tags:['微醺','夜晚'] },
    { word:'摄影', tags:['视觉','城市'] }, { word:'美食', tags:['吃喝','探索'] }, { word:'运动', tags:['活力','户外'] },
    { word:'跑步', tags:['活力','户外'] }, { word:'瑜伽', tags:['安静','身体'] }, { word:'安静', tags:['安静','深聊'] },
    { word:'热闹', tags:['热闹','社交'] }, { word:'预算低', tags:['轻量','低成本'] }, { word:'轻松', tags:['松弛','不赶'] }
  ];
  return dict.filter((item) => text.includes(item.word)).map((item) => item.word);
}

function generateRecommendations(text, mode, capacity) {
  const has = (w) => text.includes(w);
  const one = mode === 'one';
  const pool = [];
  if (has('书店') || has('咖啡') || has('安静')) pool.push({ title: one ? '在书店慢慢认识一个人' : '午后书店与咖啡小聚', content: one ? '从独立书店挑一本书，再坐下慢慢聊。' : '一起逛书店，然后坐下分享各自挑的书。', vibe: ['松弛','有点好奇'], budget: 90, location: '静安寺附近' });
  if (has('展览') || has('看展') || has('摄影')) pool.push({ title: one ? '一起看一场小型摄影展' : '摄影展后沿街散步', content: one ? '先看展，再沿街散步找地方喝一杯。' : '看完展一起散步，自然认识彼此。', vibe: ['城市漫游','有点好奇'], budget: 120, location: '黄浦区' });
  if (has('电影') || has('夜晚')) pool.push({ title: one ? '老电影与深夜热巧克力' : '小众放映与映后聊天', content: one ? '看完老电影去附近喝一杯热巧。' : '一起看电影，结束后简单聊聊感受。', vibe: ['电影','夜晚'], budget: 110, location: '静安区' });
  if (has('手作') || has('陶艺') || has('花束')) pool.push({ title: one ? '一起做一件小手作' : '手作花束与一杯咖啡', content: one ? '边做边聊，不用刻意找话题。' : '做一束不完美的花，再喝杯咖啡。', vibe: ['一起动手','温柔'], budget: 150, location: '徐汇区' });
  if (has('散步') || has('户外')) pool.push({ title: one ? '傍晚散步，边走边聊' : '城市漫步与露天咖啡', content: one ? '选一条安静的街道，慢慢走。' : '一群人沿着街道散步，再坐下休息。', vibe: ['城市漫游','不赶时间'], budget: 80, location: '市中心' });
  if (has('小酒馆') || has('微醺')) pool.push({ title: one ? '小酒馆里慢慢聊天' : '小酒馆轻松聚会', content: one ? '找一家安静的小酒馆，边喝边聊。' : '在小酒馆里轻松认识新朋友。', vibe: ['夜晚','松弛'], budget: 160, location: '巨鹿路附近' });
  if (has('美食')) pool.push({ title: one ? '一起去探索一家小店' : '美食探店小聚会', content: one ? '去一家没吃过的店，边吃边聊。' : '一起探店，分享喜欢的口味。', vibe: ['有点好奇','松弛'], budget: 130, location: '市中心' });
  if (has('运动') || has('跑步') || has('瑜伽')) pool.push({ title: one ? '一起运动，再喝杯咖啡' : '轻松运动小团体', content: one ? '运动完坐下聊聊，不用太正式。' : '一起运动，然后轻松聊天。', vibe: ['活力','松弛'], budget: 70, location: '公园附近' });
  if (pool.length < 2) pool.push({ title: one ? '在咖啡馆慢慢认识' : '咖啡馆轻松小聚', content: one ? '找一家安静的咖啡馆，慢慢聊天。' : '在咖啡馆里轻松认识彼此。', vibe: ['松弛','温柔'], budget: 100, location: '市中心' }, { title: one ? '城市散步与一杯饮料' : '城市漫游小团体', content: one ? '沿街散步，看到喜欢的店就进去。' : '一起城市漫游，自然聊天。', vibe: ['城市漫游','不赶时间'], budget: 90, location: '梧桐区' });
  return pool.slice(0, 3);
}

const aiFieldLabels = {
  title: '标题', vibe: '氛围', activity_content: '活动内容', time: '时间', location: '地点',
  capacity: '人数', budget: '预算', payment_method: '付费方式', lock_fee_enabled: 'Lock fee',
  lock_fee_amount: 'Lock fee 金额', expectations: '参与者期待'
};

function unwrapAiValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && 'value' in value ? value.value : value;
}

function aiSlotsToDraft(slots = {}) {
  const value = (key) => unwrapAiValue(slots[key]);
  const patch = {};
  if (value('title')) patch.title = String(value('title'));
  if (value('activity_content')) patch.content = String(value('activity_content'));
  if (value('proposal_text')) patch.description = String(value('proposal_text'));
  if (value('time')) patch.time = String(value('time'));
  if (value('location')) patch.location = String(value('location'));
  if (value('expectations')) patch.expectation = String(value('expectations'));
  if (value('payment_method')) {
    const payment = String(value('payment_method')).toLowerCase().replaceAll(' ', '');
    patch.payment = payment === 'host_pays' || payment === 'host请客' ? 'Host 请客' : payment === 'split' || payment === 'aa' ? 'AA' : '各自支付';
  }
  if (value('budget') !== undefined) {
    const budget = Number(value('budget'));
    if (Number.isFinite(budget)) patch.budget = budget;
  }
  if (typeof value('lock_fee_enabled') === 'boolean') patch.lockFeeEnabled = value('lock_fee_enabled');
  if (value('lock_fee_amount') !== undefined) {
    const fee = Number(value('lock_fee_amount'));
    if (Number.isFinite(fee)) patch.fee = fee;
  }
  if (value('capacity') !== undefined) {
    const capacity = Number(value('capacity'));
    if (Number.isFinite(capacity)) patch.capacity = Math.min(5, Math.max(3, capacity));
  }
  const vibe = value('vibe');
  if (vibe) patch.vibe = (Array.isArray(vibe) ? vibe : String(vibe).split(/[、,，]/)).map(String).filter(Boolean).slice(0, 3);
  return patch;
}

function appendRecognizedText(current, recognized) {
  const existing = current.trim();
  const incoming = recognized.trim().replace(/^[，。！？、,.!?\s]+/, '').replace(/[。！？!?]+$/, '');
  if (!incoming) return existing;
  if (!existing) return `${incoming}。`;
  const separator = /[，。！？、,.!?]$/.test(existing) ? '' : '。';
  return `${existing}${separator}${incoming}。`.replace(/。{2,}/g, '。');
}

function extractPreferenceTags(text) {
  const rules = [
    ['看展', /看展|展览|美术馆|画廊/],
    ['咖啡', /咖啡|手冲|咖啡馆/],
    ['书店', /书店|阅读|看书/],
    ['电影', /电影|放映|影院/],
    ['音乐', /音乐|演出|livehouse|唱片|黑胶/i],
    ['手作', /手作|陶艺|花艺|木工/],
    ['户外', /户外|徒步|公园|露营|骑行/],
    ['散步', /散步|漫步|漫游/],
    ['美食', /吃饭|美食|餐厅|火锅|私厨/],
    ['运动', /运动|跑步|篮球|瑜伽|冲浪/],
    ['安静', /安静|不吵|松弛|放松/],
    ['热闹', /热闹|多人|认识新朋友/],
    ['深聊', /深聊|聊得来|好好聊天|认真聊天/],
    ['预算友好', /预算.{0,5}(别太高|不高|低|少|有限)|便宜|别太贵|不想花太多/],
    ['周末', /周末|周六|周日/],
    ['晚上', /晚上|夜里|下班后/],
  ];
  return rules.filter(([, pattern]) => pattern.test(text)).map(([label]) => label).slice(0, 8);
}

function Avatar({ id, small = false }) { const person = people[id]; return <span className={`avatar ${small ? 'small' : ''}`}>{person?.avatarImage ? <img src={person.avatarImage} alt=""/> : (person?.avatar ?? '?')}</span>; }
function Pill({ children, tone = '' }) { return <span className={`pill ${tone}`}>{children}</span>; }
function Button({ children, kind = 'secondary', className = '', ...props }) { return <button className={`button ${kind} ${className}`} {...props}>{children}</button>; }

function App() {
  const [screen, setScreen] = useState({ name: 'splash' });
  const [screenHistory, setScreenHistory] = useState([]);
  const [dates, setDates] = useState(seedDatesAll);
  const [actor, setActor] = useState('vivi');
  const [applications, setApplications] = useState(initialApplications);
  const [saved, setSaved] = useState(['d5']);
  const [skipped, setSkipped] = useState([]);
  const [currentActivityId, setCurrentActivityId] = useState(null);
  const [discoverView, setDiscoverView] = useState('cards');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryStatus, setLibraryStatus] = useState('all');
  const [libraryMode, setLibraryMode] = useState('all');
  const [libraryCategory, setLibraryCategory] = useState('all');
  const [filters, setFilters] = useState({ time: '本周末', distance: '3 km', modes: ['one', 'small'] });
  const [filterOpen, setFilterOpen] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarChoice, setCalendarChoice] = useState('');
  const [myTab, setMyTab] = useState('joined');
  const [expiredOpen, setExpiredOpen] = useState(false);
  const [chats, setChats] = useState(initialChats);
  const [imPriority, setImPriority] = useState('');
  const [imOnly, setImOnly] = useState('');
  const [chatActionId, setChatActionId] = useState(null);
  const [contextPickerId, setContextPickerId] = useState(null);
  const [chatPlusId, setChatPlusId] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [toast, setToast] = useState('');
  const [notifications, setNotifications] = useState([{ title: 'Dive Invite 已准备好', body: '摄影展的精确集合点已开放。', dateId: 'd3', unread: true }, { title: '分享一点活动后的感受', body: '唱片店 Date 已结束，你可以评价或跳过。', dateId: 'd4', unread: false }]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState(makeCreateDraft);
  const [createStep, setCreateStep] = useState(1);
  const [createDirty, setCreateDirty] = useState(false);
  const [createExitPrompt, setCreateExitPrompt] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [aiCreate, setAiCreate] = useState({ sessionId:null, revision:1, reply:'', quickReplies:[], missing:[], messages:[], input:'', loading:false, error:'' });
  const [feedbackTab, setFeedbackTab] = useState('rating');
  const [feedbackSent, setFeedbackSent] = useState({});
  const [memory, setMemory] = useState([]);
  const [profiles, setProfiles] = useState(() => JSON.parse(JSON.stringify(initialProfiles)));
  const [profileDraft, setProfileDraft] = useState(null);
  const [discardProfileEdit, setDiscardProfileEdit] = useState(false);
  const [roleHint, setRoleHint] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [swipeMotion, setSwipeMotion] = useState({ x:0, dragging:false, exiting:false });
  const [failedCoverIds, setFailedCoverIds] = useState([]);
  const [failedActivityImageIds, setFailedActivityImageIds] = useState([]);
  const [preferenceVoice, setPreferenceVoice] = useState({ transcript:'', status:'idle' });
  const [createVoice, setCreateVoice] = useState({ status:'idle' });
  const [rejectTarget, setRejectTarget] = useState(null);
  const [backendUserId, setBackendUserId] = useState(null);
  const swipeGesture = useRef(null);
  const swipeAnimating = useRef(false);
  const swipeTimer = useRef(null);
  const suppressCardClickUntil = useRef(0);
  const preferenceVoiceTimer = useRef(null);
  const preferenceVoiceRequest = useRef(0);
  const createVoiceTimer = useRef(null);
  const createVoiceRequest = useRef(0);
  const createSpeechRecognition = useRef(null);
  const preferenceSpeechRecognition = useRef(null);
  const preferenceVoiceBase = useRef('');
  const splashEntered = useRef(false);
  const timeout = useRef();

  const enterFromSplash = () => {
    if (splashEntered.current) return;
    splashEntered.current = true;
    setScreenHistory([]);
    setScreen({ name:'dating-plan' });
    window.scrollTo({ top:0 });
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;

    async function loadBackend() {
      try {
        const autoAnonymous = import.meta.env.VITE_SUPABASE_AUTO_ANON === 'true';
        const session = autoAnonymous ? await ensureDemoSession() : await getSession();
        const remoteDates = await listDates();
        if (!active) return;

        remoteDates.forEach((date) => {
          people[date.host] = {
            name: date.hostProfile.name,
            age: date.hostProfile.age || 18,
            city: date.hostProfile.city || '',
            avatar: date.hostProfile.name.charAt(0) || 'D',
            intent: '从一场具体的 Date 开始',
            intro: date.hostProfile.intro,
            interests: date.hostProfile.interests,
          };
        });
        setDates((current) => [
          ...remoteDates,
          ...current.filter((date) => !date.backend && !remoteDates.some((remote) => remote.id === date.id)),
        ]);

        if (!session?.user) return;
        setBackendUserId(session.user.id);
        const [savedIds, remoteApplications] = await Promise.all([
          listSavedDateIds(session.user.id),
          listApplications(),
        ]);
        if (!active) return;
        remoteApplications.forEach((application) => {
          const profile = application.applicantProfile;
          if (!profile) return;
          people[application.user] = {
            name: profile.display_name || 'Dive User',
            age: profile.age || 18,
            city: profile.city || '',
            avatar: (profile.display_name || 'D').charAt(0),
            intent: '从一场具体的 Date 开始',
            intro: profile.intro || '',
            interests: profile.interests || [],
          };
        });
        setSaved((current) => [...new Set([...current, ...savedIds])]);
        setApplications((current) => [
          ...remoteApplications,
          ...current.filter((item) => !item.backend),
        ]);
      } catch (error) {
        console.warn('Supabase initialization failed; using local prototype data.', error);
      }
    }

    loadBackend();
    return () => { active = false; };
  }, []);

  const me = actor;
  const activeProfile = profiles[me] || profileSeed(me);
  const profileFor = (id) => profiles[id] || profileSeed(id);
  const currentDate = (id) => dates.find((date) => date.id === id);
  const chatContext = (chat) => currentDate(chat.contextDateId || chat.dateIds?.[0]);
  const chatRole = (chat) => { const date = chatContext(chat); return date?.host === me ? 'host' : 'guest'; };
  const lastMessage = (chat) => chat.messages?.at(-1);
  const messageSummary = (message) => message?.type === 'image' ? '[图片]' : message?.type === 'activity' ? `分享了活动：${currentDate(message.dateId)?.title || ''}` : `${message?.mine ? '你：' : ''}${message?.text || '从活动开始认识'}`;
  const appFor = (dateId) => applications.find((item) => item.dateId === dateId && item.user === 'vivi');
  const say = (message) => { setToast(message); clearTimeout(timeout.current); timeout.current = setTimeout(() => setToast(''), 2800); };
  const go = (name, params = {}, options = {}) => {
    const next = { name, ...params };
    if (options.resetHistory) setScreenHistory([]);
    else if (!options.replace) setScreenHistory((items) => [...items, screen]);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goBack = () => setScreenHistory((items) => {
    const previous = items.at(-1);
    setScreen(previous || { name: 'discover' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return items.slice(0, -1);
  });
  const unread = notifications.filter((note) => note.unread).length;
  const profileDirty = profileDraft ? JSON.stringify(profileDraft) !== JSON.stringify(activeProfile) : false;

  function beginProfileEdit() { setProfileDraft(JSON.parse(JSON.stringify(activeProfile))); go('edit-profile'); }
  function updateProfileDraft(next) { setProfileDraft((draft) => ({ ...draft, ...next })); }
  function saveProfile() { if (!profileDraft?.name?.trim()) return say('昵称不能为空'); setProfiles((items) => ({ ...items, [me]: profileDraft })); setProfileDraft(null); say('Profile 已保存并同步公开资料'); goBack(); }
  function leaveProfileEdit() { if (profileDirty) setDiscardProfileEdit(true); else { setProfileDraft(null); goBack(); } }
  function updateProfileSetting(section, key, value) { setProfiles((items) => ({ ...items, [me]: { ...activeProfile, [section]: { ...activeProfile[section], [key]: value } } })); }

  const discoverable = useMemo(() => {
    const eligible = dates.filter((date) => date.host !== me && !date.attendees.includes(me) && !skipped.includes(date.id) && !date.expired && filters.modes.includes(date.mode) && date.status === '招募中');
    return [...eligible].sort((a, b) => (balancedFeedRank[a.id] ?? Number.MAX_SAFE_INTEGER) - (balancedFeedRank[b.id] ?? Number.MAX_SAFE_INTEGER));
  }, [dates, me, skipped, filters]);
  const activeDate = discoverable.find((date) => date.id === currentActivityId) || discoverable[0] || null;

  useEffect(() => {
    setCurrentActivityId((current) => discoverable.some((date) => date.id === current) ? current : (discoverable[0]?.id ?? null));
  }, [discoverable]);

  useEffect(() => {
    const resetSwipe = () => {
      if (swipeAnimating.current) return;
      swipeGesture.current = null;
      setSwipeMotion({ x:0, dragging:false, exiting:false });
    };
    window.addEventListener('blur', resetSwipe);
    return () => {
      window.removeEventListener('blur', resetSwipe);
      clearTimeout(swipeTimer.current);
      clearTimeout(preferenceVoiceTimer.current);
      clearTimeout(createVoiceTimer.current);
      preferenceSpeechRecognition.current?.abort?.();
      createSpeechRecognition.current?.stop?.();
    };
  }, []);

  function nextActivityId(id, list = discoverable) {
    if (list.length < 2) return null;
    const position = list.findIndex((date) => date.id === id);
    if (position < 0) return list[0]?.id ?? null;
    return list[(position + 1) % list.length]?.id ?? null;
  }

  function updateDate(id, next) { setDates((items) => items.map((item) => item.id === id ? { ...item, ...next } : item)); }
  async function setActivitySaved(id, shouldSave) {
    const wasSaved = saved.includes(id);
    if (wasSaved === shouldSave) return true;
    setSaved((ids) => shouldSave ? [...new Set([...ids, id])] : ids.filter((item) => item !== id));
    const date = currentDate(id);
    if (date?.backend && backendUserId) {
      try {
        await setDateSaved(backendUserId, id, shouldSave);
      } catch (error) {
        setSaved((ids) => wasSaved ? [...new Set([...ids, id])] : ids.filter((item) => item !== id));
        say('收藏同步失败，请稍后再试');
        return false;
      }
    }
    return true;
  }
  async function toggleSave(id) {
    const shouldSave = !saved.includes(id);
    const succeeded = await setActivitySaved(id, shouldSave);
    if (succeeded) say(shouldSave ? '已加入收藏' : '已取消收藏');
    return succeeded;
  }
  function skipActivity(id, nextId = nextActivityId(id)) {
    setSkipped((items) => items.includes(id) ? items : [...items, id]);
    setCurrentActivityId(nextId);
    say('已跳过，换一场看看');
  }
  async function saveActivity(id, nextId = nextActivityId(id)) {
    const succeeded = await setActivitySaved(id, true);
    if (!succeeded) {
      setCurrentActivityId(id);
      return;
    }
    setCurrentActivityId(nextId);
    say('已收藏');
  }
  async function apply(date) {
    const note = '我很想参加，想先了解一下当天的节奏。';
    let application = { id: `a${Date.now()}`, dateId: date.id, user: 'vivi', status: '申请中', note };
    if (date.backend) {
      if (!backendUserId) return say('请先登录后再 Apply');
      try {
        application = { ...(await applyToDate(backendUserId, date.id, note)), user:me };
      } catch (error) {
        say(error?.code === '23505' ? '你已经 Apply 过这场 Date' : 'Apply 提交失败，请稍后再试');
        return;
      }
    }
    setApplications((items) => [...items, application]);
    addNotice('Host 收到一份新的 Apply', `Vivi 想参加「${date.title}」。`, date.id);
    setMyTab('joined'); say('Apply 已提交，等待 Host 回复'); go('my');
  }
  function approve(application) { setApplications((items) => items.map((item) => item.id === application.id ? { ...item, status: '待支付 Lock fee' } : item)); addNotice('Host 同意了你的 Apply', '请主动支付 Lock fee，锁定这次席位。', application.dateId); say('已同意，Guest 将收到 Lock fee 提醒'); }
  function reject(application, reason) { setApplications((items) => items.map((item) => item.id === application.id ? { ...item, status: '已拒绝', reason } : item)); addNotice('这次暂时没有匹配上', 'Host 已处理你的 Apply；内部理由不会对外展示。', application.dateId); say('已拒绝；理由仅作为匹配反馈'); }
  function lock(date) { setApplications((items) => items.map((item) => item.dateId === date.id && item.user === 'vivi' ? { ...item, status: '已 Lock' } : item)); updateDate(date.id, { attendees: [...date.attendees, 'vivi'], status: date.mode === 'one' ? '已 Lock' : date.status }); addNotice('Dive Invite 已生成', '你的席位已锁定，精确集合点现在可见。', date.id); say('Lock 成功，Dive Invite 已生成'); go('detail', { dateId: date.id }); }
  function addNotice(title, body, dateId) { setNotifications((items) => [{ title, body, dateId, unread: true }, ...items]); }
  function newChat(user, dateId) { const old = chats.find((chat) => chat.type === 'person' && chat.with === user); if (old) return go('chat', { chatId: old.id }); const chat = { id: `c${Date.now()}`, type:'person', with:user, dateIds:[dateId], contextDateId:dateId, pinned:false, unread:0, updatedAt:Date.now(), messages:[] }; setChats((items) => [chat, ...items]); go('chat', { chatId: chat.id }); }
  function postMessage(chatId, payload) { const message = typeof payload === 'string' ? { type:'text', text:payload.trim() } : payload; if (message.type === 'text' && !message.text) return; setChats((items) => items.map((chat) => chat.id === chatId ? { ...chat, unread:0, updatedAt:Date.now(), messages:[...chat.messages, { ...message, mine:true, time:'刚刚' }] } : chat)); }
  function forwardActivity(chatId, dateId) { postMessage(chatId, { type:'activity', dateId }); say('活动卡已转发'); }
  function toggleMessageReaction(chatId, messageIndex, emoji) {
    setChats((items) => items.map((chat) => chat.id !== chatId ? chat : { ...chat, updatedAt:Date.now(), messages:chat.messages.map((message,index) => {
      if (index !== messageIndex) return message;
      const reactions = message.reactions || [];
      const existing = reactions.find((reaction) => reaction.emoji === emoji);
      if (!existing) return { ...message, reactions:[...reactions, { emoji, count:1, mine:true }] };
      if (existing.mine && existing.count === 1) return { ...message, reactions:reactions.filter((reaction) => reaction.emoji !== emoji) };
      return { ...message, reactions:reactions.map((reaction) => reaction.emoji === emoji ? { ...reaction, count:reaction.count + (reaction.mine ? -1 : 1), mine:!reaction.mine } : reaction) };
    }) }));
  }
  function markChatRead(chatId) { setChats((items) => { const target = items.find((chat) => chat.id === chatId); return target?.unread ? items.map((chat) => chat.id === chatId ? { ...chat, unread:0 } : chat) : items; }); }
  function toggleChatPin(chatId) { setChats((items) => items.map((chat) => chat.id === chatId ? { ...chat, pinned:!chat.pinned } : chat)); }
  function setChatContext(chatId, dateId) { setChats((items) => items.map((chat) => chat.id === chatId ? { ...chat, contextDateId:dateId } : chat)); }

  function Header({ title, back = false, actions = true, onBack }) {
    return <header className="topbar"><div>{back ? <button className="icon" onClick={onBack || goBack} aria-label="返回">‹</button> : <button className="brand" onClick={() => go('discover', {}, { resetHistory:true })} aria-label="Dive 首页"><img src="/dive-plan-icon.png" alt="Dive"/></button>}</div><h1>{title}</h1><div className="top-actions">{actions && <><button className="role-switch" onClick={() => { setActor(actor === 'vivi' ? 'lin' : 'vivi'); say(actor === 'vivi' ? '原型角色：Host 林' : '原型角色：Guest Vivi'); }} title="原型测试角色">{actor === 'vivi' ? 'Vivi' : '林'}</button><button className="icon notification" onClick={() => setNotificationOpen(true)} aria-label="查看通知">◌{unread ? <i /> : null}</button></>}</div></header>;
  }

  function Nav() {
    const links = [
      ['discover','◒','广场'],
      ['my','◍','行程'],
      ['im','◌','消息'],
      ['profile','◐','我的']
    ];
    return <nav className="nav">
      {links.slice(0,2).map(([name, symbol, label]) => <button key={name} className={screen.name === name ? 'active' : ''} onClick={() => go(name, {}, { resetHistory:true })}><b>{symbol}</b><span>{label}</span></button>)}
      <button className="nav-create" onClick={() => go('create')}><b>＋</b><span>发起</span></button>
      {links.slice(2).map(([name, symbol, label]) => <button key={name} className={screen.name === name ? 'active' : ''} onClick={() => go(name, {}, { resetHistory:true })}><b>{symbol}</b><span>{label}</span></button>)}
    </nav>;
  }
  function Layout({ title, back, children, bare = false, noHeader = false, onBack }) { return <><aside className="desktop-note"><img src="/dive-plan-icon.png" alt="Dive"/><h2>移动端流程模拟器</h2><p>用浏览器验证逻辑与跳转。当前版本可完全离线体验，不需要连接后端。</p><button onClick={() => setPreviewOpen(true)}>打开 Preview 导览</button><button onClick={() => setRoleHint(!roleHint)}>{roleHint ? '收起测试提示' : '显示测试提示'}</button></aside><main className={`phone ${bare ? 'phone-no-nav' : 'phone-has-nav'}`}>{roleHint && <div className="prototype-ribbon">原型测试：切换「Vivi / 林」可完整走 Guest → Host 审批 → Lock 流程。</div>}{!noHeader && <Header title={title} back={back} onBack={onBack}/>}<section className={`screen ${noHeader ? 'screen-no-header' : ''}`} style={noHeader ? { padding:0 } : undefined}>{children}</section><button className="preview-fab" onClick={() => setPreviewOpen(true)} aria-label="打开 Preview 导览">Preview</button>{!bare && <Nav/>}</main>{toast && <div className="toast">{toast}</div>}{previewOpen && <PreviewGuide/>}{notificationOpen && <NotificationSheet/>}{rejectTarget && <RejectSheet/>}{discardProfileEdit && <DiscardProfileSheet/>}{chatActionId && <ChatActionSheet chat={chats.find((chat) => chat.id === chatActionId)}/>} {contextPickerId && <ContextPickerSheet chat={chats.find((chat) => chat.id === contextPickerId)}/>} {chatPlusId && <ChatPlusSheet chatId={chatPlusId}/>} {imagePreview && <ImagePreviewSheet/>}</> }

  function PreviewGuide() {
    const jump = (action) => {
      setPreviewOpen(false);
      action();
    };
    const useGuest = () => setActor('vivi');
    const useHost = () => setActor('lin');
    const shortcuts = [
      ['逛活动广场', '滑卡、收藏、查看活动详情', () => { useGuest(); setDiscoverView('cards'); go('discover', {}, { resetHistory:true }); }],
      ['列表检索活动', '搜索、筛状态、筛活动类型', () => { useGuest(); setDiscoverView('list'); go('discover', {}, { resetHistory:true }); }],
      ['Guest 申请进度', 'Apply 后的待审核与 Lock fee 状态', () => { useGuest(); setMyTab('joined'); go('my', {}, { resetHistory:true }); }],
      ['Host 审批台', '同意、拒绝、修改活动与管理席位', () => { useHost(); setMyTab('hosted'); go('my', {}, { resetHistory:true }); }],
      ['创建一场 Date', '七步发布流程，本地 AI 建议可用', () => { useHost(); setCreateStep(1); go('create'); }],
      ['活动 IM', '带活动上下文的私聊、转发和图片发送', () => { useGuest(); go('im', {}, { resetHistory:true }); }],
      ['公开 Profile', '照片、偏好、隐私与历史记录', () => { useGuest(); go('profile', {}, { resetHistory:true }); }],
    ];
    return <Sheet close={() => setPreviewOpen(false)}><section className="preview-guide"><p className="eyebrow">INTERACTIVE PREVIEW</p><h2>Dive 前端预览版</h2><p className="muted">不接后端也能完整跑通核心体验。数据会保存在当前浏览器内存里，刷新后回到初始状态。</p><div className="preview-shortcuts">{shortcuts.map(([title, copy, action]) => <button key={title} onClick={() => jump(action)}><span>✦</span><div><b>{title}</b><small>{copy}</small></div><i>›</i></button>)}</div><section className="preview-flow-note"><b>推荐演示路径</b><p>Vivi 在广场 Apply → 切到林进入 Host 审批 → 同意申请 → 切回 Vivi 支付 Lock fee → 查看 Invite 和 IM。</p></section></section></Sheet>;
  }

  function Hero({ date, compact = false, onClick, onImageClick, disabled = false }) { const host = people[date.host]; const cardImage = date.hostImage || date.coverImage; const showCoverImage = cardImage && !failedCoverIds.includes(date.id); const openCard = (event) => { if (!onClick || disabled) return; event.stopPropagation(); const imageArea = event.target === event.currentTarget || event.target.classList.contains('hero-shine'); (imageArea && onImageClick ? onImageClick : onClick)(); }; const openHostArea = (event) => { event.stopPropagation(); go('profile', { userId:date.host }); }; return <article className={`hero cover-${date.cover} ${compact ? 'compact' : ''} ${disabled ? 'is-disabled' : ''}`} onClick={openCard} aria-disabled={disabled || undefined}>{showCoverImage && <img className="hero-cover-image" src={cardImage} alt="" onError={() => setFailedCoverIds((ids) => ids.includes(date.id) ? ids : [...ids, date.id])}/>}<div className="hero-shine"/><div className="pills"><Pill>{modeName[date.mode]}</Pill><Pill>{date.status}</Pill><Pill>¥{date.budget}</Pill></div><div className="hero-body"><p className="hero-kicker">{date.mode === 'one' ? '为两个人留出一点真实时间' : '在具体场景里自然认识一群人'}</p><h2>{date.title}</h2><p>{date.content}</p><div className="date-grid frosted"><div><small>时间</small><b>{date.time}</b></div><div><small>区域</small><b>{date.location}</b></div></div><button className="host-card frosted" onClick={openHostArea} aria-label={`查看 ${host.name} 的 Profile`}><Avatar id={date.host}/><span><b>{host.name} · {host.age}</b><small>{host.intro}</small></span>{date.mode === 'small' && <AvatarStack ids={date.attendees}/>}</button></div></article>; }
  function AvatarStack({ ids = [] }) { return <div className="avatar-stack">{ids.slice(0,3).map((id) => <Avatar id={id} small key={id}/>)}{ids.length > 3 && <i>+{ids.length - 3}</i>}</div> }
  function Detail({ date }) {
    if (!date) return <Layout title="活动详情" back><Empty title="活动暂时不可用" copy="这场活动可能已被删除或缺少有效 ID。" action="返回广场" onClick={() => go('discover', {}, { resetHistory:true })}/></Layout>;
    const mine = date.host === me;
    const application = appFor(date.id);
    const locked = date.attendees.includes('vivi');
    if (mine) return <HostDetail date={date}/>;
    const host = people[date.host];
    const showActivityImage = date.coverImage && !failedActivityImageIds.includes(date.id);
    return <Layout title="活动详情" back><section className="detail-v2"><article className="detail-hero"><div className={`detail-hero-bg cover-${date.cover}`}>{showActivityImage && <img className="detail-hero-image" src={date.coverImage} alt={`${date.title} 活动图片`} onError={() => setFailedActivityImageIds((ids) => ids.includes(date.id) ? ids : [...ids, date.id])}/>}</div><div className="detail-hero-overlay"><div className="pills">{date.vibe.map((item) => <Pill tone="accent" key={item}>{item}</Pill>)}<Pill>{modeName[date.mode]}</Pill><Pill>{date.status}</Pill></div><h1>{date.title}</h1><p>{date.content}</p></div></article><section className="detail-info-grid"><div className="detail-info-card glass-strong"><span>⏱</span><b>活动时间</b><small>{date.time}</small></div><div className="detail-info-card glass-strong"><span>◎</span><b>区域</b><small>{date.location}</small></div><div className="detail-info-card glass-strong"><span>¥</span><b>预算</b><small>约 ¥{date.budget} · {date.payment}</small></div><div className="detail-info-card glass-strong"><span>📍</span><b>集合点</b><small>{locked ? date.exact : 'Lock 后开放'}</small></div></section>{date.lockFee ? <section className="detail-lock-card glass-strong"><div><b>Lock fee</b><small>¥{date.lockFee}</small></div><p>{date.refund}</p></section> : null}<button className="detail-host-card glass-strong" onClick={() => go('profile', { userId: date.host })}><Avatar id={date.host}/><div><b>{host.name} · {host.age}</b><small>{host.intro}</small></div><i>›</i></button><section className="detail-section glass-strong"><h3>这场 Date 的期待</h3><p>{date.expectation || 'Host 还没有写下具体期待，可以先问问 Host。'}</p></section>{date.mode === 'small' && <section className="detail-section glass-strong"><div className="heading"><h3>已确认参与者</h3><span>{date.attendees.length}/{date.capacity - 1} 已 Lock</span></div><AvatarStack ids={date.attendees}/><p className="muted">群体节奏：{date.rhythm} · 破冰：{date.icebreaker || '未设置'}</p></section>}{locked ? <div className="sticky"><Button onClick={() => newChat(date.host, date.id)}>活动 IM</Button><Button kind="primary" onClick={() => go('invite', { dateId: date.id })}>查看 Invite</Button></div> : application?.status === '待支付 Lock fee' ? <div className="sticky"><Button onClick={() => newChat(date.host, date.id)}>问问 Host</Button><Button kind="primary" onClick={() => lock(date)}>支付 ¥{date.lockFee || 0} Lock fee</Button></div> : application?.status === '申请中' ? <><div className="notice"><b>已提交 Apply</b><br/>申请不占位、不收费。Host 同意后你会收到 Lock fee 提醒。</div><div className="sticky"><Button kind="primary" onClick={() => newChat(date.host, date.id)}>继续和 Host 聊聊</Button></div></> : <div className="sticky"><Button onClick={() => toggleSave(date.id)}>{saved.includes(date.id) ? '已收藏' : 'Save'}</Button><Button onClick={() => newChat(date.host, date.id)}>问问 Host</Button><Button kind="primary" onClick={() => apply(date)}>Apply</Button></div>}</section></Layout>;
  }
  function Info({ label, value }) { return <div className="info"><span>{label}</span><b>{value}</b></div>; }
  function HostDetail({ date }) { const incoming = applications.filter((item) => item.dateId === date.id); const locked = date.attendees; return <Layout title="Host 管理" back><Hero date={date}/><section className="detail"><div className="notice"><b>Host 控制台</b><br/>Apply 需要手动审核，只有 Guest 完成 Lock 后才占位。</div><section className="block"><div className="heading"><h3>申请人 · {incoming.filter((item) => item.status === '待处理' || item.status === '申请中').length}</h3>{date.mode === 'small' && <button className="group-icon" disabled={locked.length < 2} onClick={() => say('活动群已建立：只包含 Host 与已 Lock Guest')}>◎</button>}</div>{incoming.length ? incoming.map((item) => <Applicant key={item.id} item={item} date={date}/>) : <p className="muted">还没有 Apply。</p>}</section><section className="block"><h3>已 Lock 参与者</h3>{locked.length ? <AvatarStack ids={locked}/> : <p className="muted">还没有人完成 Lock。</p>}</section><section className="block action-stack"><Button onClick={() => go('edit', { dateId: date.id })}>✎ 修改 Date</Button><Button kind="danger" onClick={() => { updateDate(date.id, { status: '已取消' }); say('Date 已取消并通知受影响用户'); go('my'); }}>删除 Date</Button></section></section></Layout>; }
  function Applicant({ item, date }) { const p = people[item.user]; return <article className="applicant"><div><Avatar id={item.user}/><span><b>{p.name} · {p.age}</b><small>{p.city} · {p.interests.slice(0,2).join(' / ')}</small></span><Pill tone={item.status === '已 Lock' ? 'success' : ''}>{item.status}</Pill></div><p>“{item.note}”</p><footer><Button onClick={() => newChat(item.user, date.id)}>聊天</Button>{(item.status === '待处理' || item.status === '申请中') && <><Button kind="danger" onClick={() => setRejectTarget(item)}>拒绝</Button><Button kind="primary" onClick={() => approve(item)}>同意</Button></>}</footer></article>; }

  function RejectSheet() {
    const [reason, setReason] = useState('活动期待不太一致');
    const [note, setNote] = useState('');
    const submit = () => { if (!reason) return; reject(rejectTarget, note.trim() ? `${reason}：${note.trim()}` : reason); setRejectTarget(null); };
    return <Sheet close={() => setRejectTarget(null)}><section className="reject-sheet form"><p className="eyebrow">MATCHING FEEDBACK · 仅系统可见</p><h2>这次先不合适</h2><p className="muted">不会把理由发给申请人；它只会作为后续推荐的反馈信号。</p><label>主要原因<select value={reason} onChange={(event) => setReason(event.target.value)}><option>活动期待不太一致</option><option>节奏或时间不合适</option><option>人数偏好不匹配</option><option>其他</option></select></label><label>补充说明（可选）<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：更适合喜欢安静看展的参与者。"/></label><Button kind="danger" className="full" onClick={submit}>确认拒绝</Button></section></Sheet>;
  }

  function Splash() {
    return <main className="splash-screen" role="button" tabIndex="0" aria-label="进入 Dive" onClick={enterFromSplash} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') enterFromSplash(); }}>
      <img className="splash-logo" src="/dive-logo.png" alt="Dive"/>
      <h1 className="splash-title">
        <span>Dive into real connections,</span>
        <span>in your free time.</span>
      </h1>
    </main>;
  }

  function DatingPlan() {
    const connect = (provider) => { setCalendarChoice(provider); setCalendarConnected(true); say(`${provider} Calendar 已模拟连接`); };
    return <Layout title="Set up your dating plan" bare noHeader><section className="dating-plan"><img src="/dive-plan-icon.png" className="dating-plan-logo" alt="Dive"/><h1>What's your<br/>dating plan<br/>this week?</h1><p className="dating-plan-copy">告别无聊的线上聊天，用一次活动开启自然的见面和约会。</p>{calendarConnected ? <section className="availability-card glass-strong"><span className="availability-orb">✓</span><p>已连接 {calendarChoice} Calendar</p><h2>这周的 2 个可约空档</h2><div className="availability-slots"><button>周四 · 19:30</button><button>周日 · 15:00</button></div><Button kind="primary" className="full" onClick={() => { setFilters({ ...filters, time:'本周可约' }); setCurrentActivityId(null); go('voice-preference'); }}>为我的空档找 Date</Button></section> : <section className="calendar-card glass-strong"><span className="calendar-glyph">◷</span><h2>When are you free</h2><p>连接你的日历，让我们帮你挑选合适时间的活动。</p><Button className="full" onClick={() => connect('Google')}>连接 Google Calendar</Button><Button className="full" onClick={() => connect('Apple')}>连接 Apple Calendar</Button></section>}<button className="manual-plan" onClick={() => { go('voice-preference'); setFilterOpen(true); }}>我想自己选时间和距离 <span>›</span></button></section></Layout>;
  }

  function VoicePreference() {
    const transcript = preferenceVoice.transcript;
    const voiceStatus = preferenceVoice.status;
    const keywords = useMemo(() => extractPreferenceTags(transcript), [transcript]);
    const toggleListening = () => {
      if (voiceStatus === 'listening') {
        preferenceVoiceRequest.current += 1;
        preferenceSpeechRecognition.current?.abort?.();
        setPreferenceVoice({ transcript:preferenceVoiceBase.current, status:'cancelled' });
        say('已取消本次录音');
        return;
      }
      const requestId = ++preferenceVoiceRequest.current;
      preferenceSpeechRecognition.current?.abort?.();
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setPreferenceVoice((state) => ({ ...state, status:'failed' }));
        say('当前浏览器不支持语音识别，请直接输入文字');
        return;
      }
      const baseTranscript = transcript;
      preferenceVoiceBase.current = baseTranscript;
      setPreferenceVoice({ transcript:baseTranscript, status:'listening' });
      try {
        const recognition = new SpeechRecognition();
        preferenceSpeechRecognition.current = recognition;
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = true;
        let finalText = '';
        let recognitionFailed = false;
        recognition.onresult = (event) => {
          let interimText = '';
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const text = event.results[index][0]?.transcript || '';
            if (event.results[index].isFinal) finalText += text;
            else interimText += text;
          }
          const recognized = `${finalText}${interimText}`.trim();
          if (!recognized || preferenceVoiceRequest.current !== requestId) return;
          setPreferenceVoice({ transcript:appendRecognizedText(baseTranscript, recognized), status:'listening' });
        };
        recognition.onerror = (event) => {
          if (preferenceVoiceRequest.current !== requestId || event.error === 'aborted') return;
          recognitionFailed = true;
          const denied = event.error === 'not-allowed' || event.error === 'service-not-allowed';
          const unavailable = event.error === 'audio-capture';
          setPreferenceVoice({ transcript:baseTranscript, status:'failed' });
          say(denied ? '麦克风权限未开启，请在浏览器设置中允许访问' : unavailable ? '未检测到可用麦克风，请直接输入文字' : '识别失败，请再试一次或直接输入文字');
        };
        recognition.onend = () => {
          if (preferenceVoiceRequest.current !== requestId || recognitionFailed) return;
          const recognized = finalText.trim();
          if (!recognized) {
            setPreferenceVoice({ transcript:baseTranscript, status:'failed' });
            say('没有识别到内容，请再试一次或直接输入文字');
            return;
          }
          setPreferenceVoice({ transcript:appendRecognizedText(baseTranscript, recognized), status:'completed' });
          say('已识别并写入文字');
        };
        recognition.start();
      } catch {
        setPreferenceVoice({ transcript:baseTranscript, status:'failed' });
        say('无法启动麦克风，请检查浏览器权限');
      }
    };
    const applyAndGo = () => { preferenceVoiceRequest.current += 1; preferenceSpeechRecognition.current?.abort?.(); say('已记录你的偏好，进入活动广场'); go('discover', {}, { resetHistory:true }); };
    const voiceLabel = voiceStatus === 'listening' ? '正在听，再次点击取消' : voiceStatus === 'completed' ? '识别完成，可继续补充' : voiceStatus === 'cancelled' ? '已取消，可重新开始' : voiceStatus === 'failed' ? '识别失败，请使用文字输入' : '点击说话';
    return <Layout title="AI 助手" bare noHeader><section className="voice-preference"><div className="voice-preference-orb"/><p className="eyebrow">DIVE ASSISTANT</p><h1>最近想参加<br/>什么活动？</h1><p className="voice-preference-copy">用语音或文字告诉我，我会记住你的偏好，再为你挑合适的 Date。</p><section className="voice-input-card glass-strong"><button className={`voice-mic ${voiceStatus === 'listening' ? 'listening' : ''}`} onClick={toggleListening} aria-label={voiceStatus === 'listening' ? '取消录音' : '开始录音'}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></button><b>{voiceLabel}</b></section><label className="voice-text-label">或直接输入<textarea value={transcript} placeholder="例如：周末想去看展，预算别太高…" onChange={(event) => setPreferenceVoice({ transcript:event.target.value, status:'idle' })}/></label>{(transcript || voiceStatus === 'listening') && <section className="voice-keywords"><b>AI 提取到的偏好</b><div>{keywords.length ? keywords.map((word) => <span key={word}>{word}</span>) : <span className="placeholder">继续说说你的偏好</span>}</div></section>}<Button kind="primary" className="full" onClick={applyAndGo}>{transcript ? '就用这个偏好' : '跳过，去活动广场'}</Button><p className="voice-disclaimer">语音仅用于本次识别；你可以随时改用文字输入。</p></section></Layout>;
  }

  function Discover() {
    const nextId = activeDate ? nextActivityId(activeDate.id) : null;
    const nextDate = discoverable.find((date) => date.id === nextId);
    const libraryDates = dates.filter((date) => date.source === 'library');
    const libraryCategories = [...new Set(libraryDates.map((date) => date.activityCategory).filter(Boolean))];
    const normalizedQuery = libraryQuery.trim().toLowerCase();
    const filteredLibraryDates = libraryDates.filter((date) => {
      const matchesQuery = !normalizedQuery || [date.title, date.content, date.location, ...(date.tags || [])].join(' ').toLowerCase().includes(normalizedQuery);
      const matchesStatus = libraryStatus === 'all' || date.status === libraryStatus;
      const matchesMode = libraryMode === 'all' || date.mode === libraryMode;
      const matchesCategory = libraryCategory === 'all' || date.activityCategory === libraryCategory;
      return matchesQuery && matchesStatus && matchesMode && matchesCategory;
    });
    const resetSwipe = () => {
      swipeGesture.current = null;
      swipeAnimating.current = false;
      setSwipeMotion({ x:0, dragging:false, exiting:false });
    };
    const completeSwipe = (direction, id) => {
      if (swipeAnimating.current || !id) return;
      const nextActivity = nextActivityId(id);
      const width = swipeGesture.current?.width || 390;
      swipeAnimating.current = true;
      suppressCardClickUntil.current = Date.now() + 400;
      setSwipeMotion({ x:(direction === 'right' ? 1 : -1) * width * 1.2, dragging:false, exiting:true });
      clearTimeout(swipeTimer.current);
      swipeTimer.current = setTimeout(async () => {
        if (direction === 'right') await saveActivity(id, nextActivity);
        else skipActivity(id, nextActivity);
        resetSwipe();
      }, 220);
    };
    const onPointerDown = (event) => {
      if (swipeAnimating.current || event.button !== 0 || event.target.closest('button')) return;
      const width = event.currentTarget.getBoundingClientRect().width;
      swipeGesture.current = { pointerId:event.pointerId, startX:event.clientX, width, dragged:false };
      event.currentTarget.setPointerCapture(event.pointerId);
      setSwipeMotion({ x:0, dragging:false, exiting:false });
    };
    const onPointerMove = (event) => {
      const gesture = swipeGesture.current;
      if (!gesture || gesture.pointerId !== event.pointerId || swipeAnimating.current) return;
      const x = event.clientX - gesture.startX;
      if (!gesture.dragged && Math.abs(x) <= 8) return;
      gesture.dragged = true;
      gesture.x = x;
      suppressCardClickUntil.current = Date.now() + 350;
      setSwipeMotion({ x, dragging:true, exiting:false });
    };
    const onPointerEnd = (event, cancelled = false) => {
      const gesture = swipeGesture.current;
      if (!gesture || gesture.pointerId !== event.pointerId || swipeAnimating.current) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (!cancelled && gesture.dragged && Math.abs(gesture.x || 0) >= gesture.width * .25) {
        completeSwipe(gesture.x > 0 ? 'right' : 'left', activeDate.id);
        return;
      }
      swipeGesture.current = null;
      setSwipeMotion({ x:0, dragging:false, exiting:false });
    };
    const canOpenActivity = (date) => Boolean(date?.id && currentDate(date.id));
    const openActivity = (date) => {
      if (!canOpenActivity(date)) return say('这场活动暂时无法打开');
      go('detail', { dateId:date.id });
    };
    const goDetail = () => {
      if (Date.now() >= suppressCardClickUntil.current) openActivity(activeDate);
    };
    const likeAndOpen = async (date) => {
      if (!canOpenActivity(date)) return say('这场活动暂时无法打开');
      const succeeded = await setActivitySaved(date.id, true);
      if (succeeded) openActivity(date);
    };
    const likeImageAndOpen = () => {
      if (Date.now() >= suppressCardClickUntil.current) likeAndOpen(activeDate);
    };
    return <Layout title="广场"><section className={`discover-page ${discoverView === 'list' ? 'library-view' : ''}`}><div className="discover-viewbar"><div><p>DISCOVER LIBRARY</p><b>{libraryDates.length} 场具体活动</b></div><div className="discover-view-toggle" aria-label="浏览方式"><button className={discoverView === 'cards' ? 'active' : ''} onClick={() => setDiscoverView('cards')} aria-label="Feed 卡片浏览" title="Feed 卡片浏览">▣</button><button className={discoverView === 'list' ? 'active' : ''} onClick={() => setDiscoverView('list')} aria-label="列表浏览" title="列表浏览">☷</button></div></div>{discoverView === 'cards' ? <><div className="discover-tools"><button className={`discover-tool ${calendarConnected ? 'is-connected' : ''}`} onClick={() => go('dating-plan')} aria-label="Dating Plan" title="Dating Plan">◷</button><button className="discover-tool" onClick={() => setFilterOpen(true)} aria-label="手动筛选" title="手动筛选">☷</button></div>{activeDate ? <><div className="swipe-stage immersive"><div className="swipe-next" aria-hidden="true">{nextDate && <Hero date={nextDate} compact disabled={!canOpenActivity(nextDate)}/>}</div><div className={`swipe-card ${swipeMotion.dragging ? 'is-dragging' : ''} ${swipeMotion.exiting ? 'is-exiting' : ''} ${canOpenActivity(activeDate) ? '' : 'is-disabled'}`} style={{ transform:`translateX(${swipeMotion.x}px) rotate(${swipeMotion.x / 24}deg)`, opacity:Math.max(.2, 1 - Math.abs(swipeMotion.x) / 760) }} onClick={goDetail} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={(event) => onPointerEnd(event)} onPointerCancel={(event) => onPointerEnd(event, true)}><Hero date={activeDate} onClick={goDetail} onImageClick={likeImageAndOpen} disabled={!canOpenActivity(activeDate)}/>{swipeMotion.x < -15 && <span className="swipe-stamp no">跳过</span>}{swipeMotion.x > 15 && <span className="swipe-stamp yes">收藏</span>}<div className="compact-choices"><button onClick={(event) => { event.stopPropagation(); completeSwipe('left', activeDate.id); }} aria-label="跳过" title="跳过">×</button><button onClick={(event) => { event.stopPropagation(); toggleSave(activeDate.id); }} aria-label={saved.includes(activeDate.id) ? '取消收藏' : '收藏'} title={saved.includes(activeDate.id) ? '取消收藏' : '收藏'}>{saved.includes(activeDate.id) ? '⚑' : '⚐'}</button><button className="yes" onClick={(event) => { event.stopPropagation(); likeAndOpen(activeDate); }} aria-label="喜欢并查看活动" title="喜欢并查看活动">♥</button></div></div></div><p className="swipe-hint">左滑跳过 · 右滑收藏 · 点击卡片查看详情</p></> : <Empty title="附近暂时没有合适的 Date" copy="调整一下时间、距离或人数偏好，再回来看看。" action="调整筛选" onClick={() => setFilterOpen(true)}/>}</> : <><section className="library-filters"><label className="library-search"><span>⌕</span><input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="搜索活动、地点或标签"/></label><div><select aria-label="活动状态" value={libraryStatus} onChange={(event) => setLibraryStatus(event.target.value)}><option value="all">全部状态</option><option value="招募中">招募中</option><option value="已 Lock">已满</option><option value="已结束">已结束</option></select><select aria-label="活动形式" value={libraryMode} onChange={(event) => setLibraryMode(event.target.value)}><option value="all">全部形式</option><option value="one">双人</option><option value="small">多人</option></select></div><select className="library-category" aria-label="活动类别" value={libraryCategory} onChange={(event) => setLibraryCategory(event.target.value)}><option value="all">全部类别</option>{libraryCategories.map((category) => <option value={category} key={category}>{category}</option>)}</select></section><div className="library-result-heading"><span>活动清单</span><small>{filteredLibraryDates.length} / {libraryDates.length}</small></div>{filteredLibraryDates.length ? <div className="library-list">{filteredLibraryDates.map((date) => <ActivityLibraryRow date={date} key={date.id}/>)}</div> : <Empty title="没有匹配的活动" copy="换一个关键词或清除筛选条件再看看。" action="清除筛选" onClick={() => { setLibraryQuery(''); setLibraryStatus('all'); setLibraryMode('all'); setLibraryCategory('all'); }}/>}</>}</section>{filterOpen && <FilterSheet/>}</Layout>;
  }
  function ActivityLibraryRow({ date }) {
    const isSaved = saved.includes(date.id);
    const canOpen = Boolean(date?.id && currentDate(date.id));
    const cardImage = date.hostImage || date.coverImage;
    return <article className={`library-row ${canOpen ? '' : 'is-disabled'}`}><button className="library-row-main" disabled={!canOpen} onClick={() => canOpen && go('detail', { dateId:date.id })}><span className={`library-cover library-cover-${date.cover}`}>{cardImage && !failedCoverIds.includes(date.id) && <img src={cardImage} alt="" onError={() => setFailedCoverIds((ids) => ids.includes(date.id) ? ids : [...ids, date.id])}/>}</span><span className="library-row-copy"><span className="library-row-meta"><em>{date.activityCategory}</em><i className={`status-${date.status === '招募中' ? 'live' : date.status === '已结束' ? 'ended' : 'full'}`}>{date.status === '已 Lock' ? '已满' : date.status}</i></span><b>{date.title}</b><small>{date.time} · {date.location}</small><span className="library-row-facts"><em>{date.mode === 'one' ? '双人' : `${date.capacity} 人`}</em><em>{date.budgetText || `人均 ¥${date.budget}`}</em>{date.applicants > 0 && <em>{date.applicants} 人申请</em>}{!canOpen && <em>活动不可用</em>}</span></span></button><button className={`library-save ${isSaved ? 'saved' : ''}`} disabled={!canOpen} onClick={() => toggleSave(date.id)} aria-label={isSaved ? '取消收藏' : '收藏活动'} title={isSaved ? '取消收藏' : '收藏活动'}>{isSaved ? '⚑' : '⚐'}</button></article>;
  }
  function FilterSheet() { return <Sheet close={() => setFilterOpen(false)}><section className="light-filter"><p className="eyebrow">DISCOVER</p><h2>Find a Date</h2><p className="muted">日历是自动筛选；下面的三个字段可以随时手动覆盖。</p>{calendarConnected ? <button className="calendar-status" onClick={() => { setFilters({ ...filters, time:'本周可约' }); say('已优先使用日历空档'); }}><span>✓</span><div><b>{calendarChoice} Calendar 已同步</b><small>优先展示这周有空的时间</small></div><i>›</i></button> : <button className="calendar-status" onClick={() => { setFilterOpen(false); go('dating-plan'); }}><span>◷</span><div><b>连接日历自动筛选</b><small>避开已有安排，随时可断开</small></div><i>›</i></button>}<div className="manual-filter-fields"><label>时间<select value={filters.time} onChange={(event) => setFilters({ ...filters, time:event.target.value })}><option>本周可约</option><option>今天</option><option>本周末</option><option>下周</option></select></label><label>距离<select value={filters.distance} onChange={(event) => setFilters({ ...filters, distance:event.target.value })}><option>1 km</option><option>3 km</option><option>5 km</option><option>10 km</option><option>全城</option></select></label><label>形式<select value={filters.modes.length === 1 ? filters.modes[0] : 'all'} onChange={(event) => setFilters({ ...filters, modes:event.target.value === 'all' ? ['one','small'] : [event.target.value] })}><option value="all">1v1 与 Small Date</option><option value="one">仅 1v1 Date</option><option value="small">仅 Small Date</option></select></label></div><div className="sheet-actions"><Button onClick={() => setFilters({ time:'本周末', distance:'3 km', modes:['one','small'] })}>重置</Button><Button kind="primary" onClick={() => { setCurrentActivityId(null); setFilterOpen(false); say('已更新 Date 偏好'); }}>完成</Button></div></section></Sheet>; }
  function ChoiceGroup({ label, values, labels = {}, selected, onClick, multi }) { return <section className="choice-group"><b>{label}</b><div>{values.map((value) => <button className={selected.includes(value) ? 'selected' : ''} key={value} onClick={() => onClick(value)}>{labels[value] || value}</button>)}</div></section>; }
  function MyActivities() {
    const joined = dates.filter((date) => date.attendees.includes(me) || (me === 'vivi' && ['申请中','待支付 Lock fee'].includes(appFor(date.id)?.status)));
    const hosted = dates.filter((date) => date.host === me);
    const favorites = dates.filter((date) => saved.includes(date.id));
    const fresh = favorites.filter((date) => !date.expired);
    const old = favorites.filter((date) => date.expired);
    const list = myTab === 'joined' ? joined : myTab === 'hosted' ? hosted : fresh;
    const locked = joined.filter((date) => date.attendees.includes(me)).length;
    const active = joined.filter((date) => date.status !== '已结束').length + hosted.filter((date) => date.status === '招募中').length;
    const gaugeData = [
      { name: '已确认', value: joined.length ? Math.round((locked / joined.length) * 100) : 0, color: '#d8b4fe' },
      { name: '招募中', value: hosted.length ? Math.round((hosted.filter((date) => date.status === '招募中').length / hosted.length) * 100) : 0, color: '#bae6fd' },
      { name: '收藏待定', value: Math.min(100, fresh.length * 34), color: '#f9c6da' },
    ];
    return <Layout title="行程"><section className="my-activities">
      <button className="activity-pulse glass-strong" onClick={() => go('activity-controls')}>
        <div><p>ACTIVITY PULSE</p><h2>{active ? `${active} 场进行中` : '安排下一场 Date'}</h2><small>申请、Lock 与收藏状态一目了然 <i>›</i></small></div>
        <ActivityGaugeXs title={`${active}`} subtitle="Dates in motion" data={gaugeData}/>
      </button>
      <div className="my-tabs">{[['joined','我参与的'],['saved','我收藏的'],['hosted','我发起的']].map(([id,label]) => <button className={myTab === id ? 'active' : ''} onClick={() => setMyTab(id)} key={id}>{label}</button>)}</div>
      <div className="my-list-heading"><div><p>{myTab === 'hosted' ? 'HOSTED DATES' : myTab === 'saved' ? 'SAVED FOR LATER' : 'DATES IN MOTION'}</p><h2>{myTab === 'joined' ? '我参与的' : myTab === 'saved' ? '我收藏的' : '我发起的'}</h2></div>{myTab === 'hosted' && <button className="create-mini" onClick={() => go('create')}>＋</button>}</div>
      {list.length ? <div className="activity-stack">{list.map((date) => <DateRow key={date.id} date={date}/>)}</div> : <Empty title="这里还没有 Date" copy={myTab === 'hosted' ? '从一个想和别人一起做的具体小事开始。' : '去活动广场看一看。'} action={myTab === 'hosted' ? '创建 Date' : '去活动广场'} onClick={() => go(myTab === 'hosted' ? 'create' : 'discover')}/>}
      {myTab === 'saved' && old.length > 0 && <><button className="folder expired-folder" onClick={() => setExpiredOpen(!expiredOpen)}><span>▱ 已过期</span><small>{old.length} 场结束超过两天的 Date {expiredOpen ? '⌃' : '⌄'}</small></button>{expiredOpen && <div className="activity-stack expired-stack">{old.map((date) => <DateRow key={date.id} date={date}/>)}</div>}</>}
      <button className="create-nudge" onClick={() => go('create')}><span>✦</span><div><small>下一次想认识谁？</small><b>发起一场具体的 Date</b></div><i>＋</i></button>
    </section></Layout>;
  }

  function ActivityControls() {
    const hosted = dates.filter((date) => date.host === me);
    const joined = dates.filter((date) => date.attendees.includes(me));
    const pending = applications.filter((item) => dates.find((date) => date.id === item.dateId)?.host === me && ['待处理','申请中'].includes(item.status)).length;
    const locked = joined.filter((date) => date.status !== '已结束').length;
    const savedLive = dates.filter((date) => saved.includes(date.id) && !date.expired).length;
    const completed = dates.filter((date) => date.status === '已结束' && (date.host === me || date.attendees.includes(me))).length;
    return <Layout title="活动控制" back bare><section className="activity-controls">
      <p className="eyebrow">DIVE ACTIVITY CONTROL</p>
      <h1>相遇，不必<br/>赶进度。</h1>
      <p className="muted">这里只记录属于你的节奏；它不是 KPI，也不会展示给其他人。</p>
      <section className="rhythm-feature glass-strong"><div><p>THIS MONTH</p><h2>给真实见面<br/>留一点余地。</h2><small>已确认、完成和收藏的 Date，会轻轻地留在这里。</small></div><ActivityGaugeLg title={`${Math.min(100,completed * 32 + locked * 18)}%`} subtitle="本月相遇节奏" data={[{ name:'已完成', value:Math.min(100,completed * 45), color:'#f9c6da' },{ name:'已确认', value:Math.min(100,locked * 42), color:'#d8b4fe' },{ name:'正在浏览', value:Math.min(100,savedLive * 38 + 32), color:'#bae6fd' }]}/></section>
      <section className="control-action-list"><button onClick={() => { setMyTab('hosted'); go('my'); }}><span>✦</span><div><b>{pending ? `${pending} 份 Apply 等你看` : '暂时没有待处理 Apply'}</b><small>Host 始终手动决定是否继续。</small></div><i>›</i></button><button onClick={() => { setMyTab('joined'); go('my'); }}><span>◌</span><div><b>{locked ? `${locked} 场 Date 已经确认` : '还没有确认的 Date'}</b><small>已 Lock 后，集合点和 Invite 会在这里出现。</small></div><i>›</i></button><button onClick={() => { setMyTab('saved'); go('my'); }}><span>♡</span><div><b>{savedLive ? `${savedLive} 场留给以后决定` : '没有待决定收藏'}</b><small>想去的时候，再 Apply 就好。</small></div><i>›</i></button></section>
      <button className="control-create" onClick={() => go('create')}><span>✦</span><div><small>想把一个念头变成计划？</small><b>发起一场 Date</b></div><i>＋</i></button>
    </section></Layout>;
  }
  function FlowStepper({ step }) { return <div className="flow-stepper">{['模式','提取','细节','Plan','发布'].map((label, index) => <span className={index + 1 <= step ? 'active' : ''} key={label}><i>{index + 1}</i><small>{label}</small></span>)}</div>; }
  function CreateV2() {
    const d = createDraft;
    const toggleVibe = (vibe) => setCreateDraft({ ...d, vibe: d.vibe.includes(vibe) ? d.vibe.filter((item) => item !== vibe) : d.vibe.length < 3 ? [...d.vibe, vibe] : d.vibe });
    const publish = () => { const next = { id:`d${Date.now()}`, host:me, mode:d.mode, title:d.title, cover:'custom', vibe:d.vibe, content:d.content, description:d.description, time:d.time, location:d.location, exact:d.exact || 'Host 将在 Lock 后开放精确集合点', budget:d.budget, payment:d.payment, lockFee:d.fee, refund:'活动开始前 24 小时可退', expectation:d.expectation, capacity:d.capacity, attendees:[], status:'招募中', rhythm:d.groupRhythm }; setDates([next, ...dates]); setCreateStep(1); setMyTab('hosted'); say('Date 已发布，等待你手动审核 Apply'); go('my'); };
    return <Layout title="创建 Date" back bare><FlowStepper step={createStep}/>{createStep === 1 && <section className="card form glass-strong"><p className="eyebrow">01 · 先决定怎么认识</p><h2>创建一场真实的 Date</h2><p className="muted">Date 是一场具体、可执行的见面，而不是泛社交邀请。</p><div className="mode-buttons"><button className={d.mode === 'one' ? 'selected' : ''} onClick={() => setCreateDraft({ ...d, mode:'one', capacity:2 })}>1v1 Date<small>你就是本次约会对象</small></button><button className={d.mode === 'small' ? 'selected' : ''} onClick={() => setCreateDraft({ ...d, mode:'small', capacity:3 })}>Small Date<small>Host + 2–4 位 Guest</small></button></div>{d.mode === 'small' && <ChoiceGroup label="总人数" values={[3,4,5]} selected={[d.capacity]} onClick={(capacity) => setCreateDraft({ ...d, capacity:Number(capacity) })}/>}<label>用一句话说说想一起做什么<textarea value={d.content} placeholder="例如：周日下午去逛书店，再坐下来喝一杯咖啡。" onChange={(e) => setCreateDraft({ ...d, content:e.target.value })}/></label><Button kind="primary" className="full" onClick={() => d.content.trim() ? setCreateStep(2) : say('先说说想一起做什么')}>让 AI 整理这场 Date</Button></section>}{createStep === 2 && <section className="card form glass-strong"><p className="eyebrow">02 · AI 字段提取</p><h2>我先理解了这些</h2><div className="field-status"><span>✓ 已知</span><b>活动内容</b><p>{d.content}</p></div><div className="field-status"><span>需要确认</span><b>标题、氛围与活动描述</b><p>AI 只提出建议，不会替你发布、回复或支付。</p></div><FormInput label="活动标题" value={d.title} onChange={(title) => setCreateDraft({ ...d, title })}/><ChoiceGroup label="活动氛围（1–3 个）" values={['松弛','有点好奇','温柔','一起动手','城市漫游','不赶时间']} selected={d.vibe} multi onClick={toggleVibe}/><FormInput label="活动描述" area value={d.description} onChange={(description) => setCreateDraft({ ...d, description })}/><div className="sheet-actions"><Button onClick={() => setCreateStep(1)}>返回</Button><Button kind="primary" onClick={() => setCreateStep(3)}>确认这些信息</Button></div></section>}{createStep === 3 && <section className="card form glass-strong"><p className="eyebrow">03 · 核心字段</p><h2>把行程讲清楚</h2><FormInput label="活动时间（支持模糊输入）" value={d.time} onChange={(time) => setCreateDraft({ ...d, time })}/><FormInput label="公开区域" value={d.location} onChange={(location) => setCreateDraft({ ...d, location })}/><FormInput label="精确集合点（仅 Lock 后可见）" value={d.exact} onChange={(exact) => setCreateDraft({ ...d, exact })}/><FormInput label="预算（人均）" type="number" value={d.budget} onChange={(budget) => setCreateDraft({ ...d, budget:Number(budget) })}/><label>付费方式<select value={d.payment} onChange={(event) => setCreateDraft({ ...d, payment:event.target.value })}><option>AA</option><option>Host 请客</option><option>各自支付</option></select></label><FormInput label="Lock fee（可为 0）" type="number" value={d.fee} onChange={(fee) => setCreateDraft({ ...d, fee:Number(fee) })}/><FormInput label="对参与者的期待" area value={d.expectation} onChange={(expectation) => setCreateDraft({ ...d, expectation })}/>{d.mode === 'small' && <><label>群体节奏<select value={d.groupRhythm} onChange={(event) => setCreateDraft({ ...d, groupRhythm:event.target.value })}><option>轻松聊天</option><option>有主题流程</option><option>安静共处</option></select></label><FormInput label="中途离开说明" area value="需要提前离开可以告诉 Host，安全永远优先。" onChange={() => {}}/></>}<ChoiceGroup label="可见范围" values={['公开','仅好友可见']} selected={[d.visibility]} onClick={(visibility) => setCreateDraft({ ...d, visibility })}/><div className="sheet-actions"><Button onClick={() => setCreateStep(2)}>返回</Button><Button kind="primary" onClick={() => setCreateStep(4)}>生成 Date Plan</Button></div></section>}{createStep === 4 && <section className="card form glass-strong"><p className="eyebrow">04 · AI Date Plan</p><div className="plan"><span>✦</span><h2>{d.title}</h2><p>{d.content}</p></div><div className="plan-chips"><button onClick={() => setCreateDraft({...d,time:'下周日 15:00'})}>换个时间</button><button onClick={() => setCreateDraft({...d,budget:Math.max(0,d.budget - 20)})}>更轻量预算</button><button onClick={() => setCreateDraft({...d,vibe:['松弛','温柔']})}>更松弛一点</button></div><div className="timeline"><p><b>{d.time}</b><br/><span>在 {d.location} 附近集合</span></p><p><b>{d.content}</b><br/><span>预算约 ¥{d.budget} · {d.payment} · Lock fee ¥{d.fee}</span></p><p><b>自然结束</b><br/><span>安全离开永远优先，不需要勉强续场。</span></p></div><div className="sheet-actions"><Button onClick={() => setCreateStep(3)}>返回修改</Button><Button kind="primary" onClick={() => setCreateStep(5)}>确认这份 Plan</Button></div></section>}{createStep === 5 && <section className="card form publish-preview"><p className="eyebrow">05 · 发布预览</p><h2>这就是别人将看到的 Date</h2><Hero date={{ ...d, host:me, cover:'custom', attendees:[], status:'招募中' }} compact/><div className="publish-checks"><p>✓ 公开摘要：标题、区域、预算、期待与 Host 公开资料</p><p>✓ 精确集合点：只对已 Lock Guest 开放</p><p>✓ Lock fee：由 Guest 在 Host 同意后主动支付</p><p>✓ 申请选择：你仍需手动同意或拒绝</p></div><div className="notice"><b>最后确认</b><br/>发布后会进入活动池；重要修改会通知已申请 / 已确认用户，不能静默覆盖关键行程信息。</div><div className="sheet-actions"><Button onClick={() => setCreateStep(4)}>返回</Button><Button kind="primary" onClick={publish}>确认并发布</Button></div></section>}</Layout>;
  }
  function DateRow({ date }) { const status = date.attendees.includes(me) ? (date.status === '已结束' ? '已结束' : '已确认') : appFor(date.id)?.status || date.status; return <button className="date-row" onClick={() => go('detail', { dateId: date.id })}><span className="cover-symbol">{date.cover === 'flowers' ? '✿' : date.cover === 'books' ? '▤' : date.cover === 'photo' ? '◫' : '✦'}</span><span><b>{date.title}</b><small>{date.time} · {modeName[date.mode]} · {status}</small></span>{date.mode === 'small' && date.attendees.includes(me) && <AvatarStack ids={date.attendees}/>}<i>›</i></button>; }
  function Create() { const d = createDraft; const toggleVibe = (vibe) => setCreateDraft({ ...d, vibe: d.vibe.includes(vibe) ? d.vibe.filter((item) => item !== vibe) : d.vibe.length < 3 ? [...d.vibe, vibe] : d.vibe }); return <Layout title="创建 Date" back bare><Stepper step={createStep}/>{createStep === 1 && <section className="card form"><p className="eyebrow">先决定这一场怎么认识</p><h2>创建一场 Date</h2><div className="mode-buttons"><button className={d.mode === 'one' ? 'selected' : ''} onClick={() => setCreateDraft({ ...d, mode:'one', capacity:2 })}>1v1 Date<small>你就是约会对象</small></button><button className={d.mode === 'small' ? 'selected' : ''} onClick={() => setCreateDraft({ ...d, mode:'small', capacity:3 })}>Small Date<small>Host + 2–4 位 Guest</small></button></div>{d.mode === 'small' && <ChoiceGroup label="总人数" values={[3,4,5]} selected={[d.capacity]} onClick={(capacity) => setCreateDraft({ ...d, capacity:Number(capacity) })}/>}<label>想一起做什么<textarea value={d.content} onChange={(e) => setCreateDraft({ ...d, content:e.target.value })}/></label><ChoiceGroup label="活动氛围（1–3 个）" values={['松弛','有点好奇','温柔','一起动手','城市漫游','不赶时间']} selected={d.vibe} multi onClick={toggleVibe}/><Button kind="primary" className="full" onClick={() => d.content.trim() ? setCreateStep(2) : say('先说说想一起做什么')}>继续，补全 Date 细节</Button></section>}{createStep === 2 && <section className="card form"><p className="eyebrow">Date 的核心字段</p><h2>让每个人都知道要去哪里</h2><FormInput label="活动标题" value={d.title} onChange={(title) => setCreateDraft({ ...d, title })}/><FormInput label="活动描述" area value={d.description} onChange={(description) => setCreateDraft({ ...d, description })}/><FormInput label="时间" value={d.time} onChange={(time) => setCreateDraft({ ...d, time })}/><FormInput label="区域" value={d.location} onChange={(location) => setCreateDraft({ ...d, location })}/><FormInput label="预算（人均）" type="number" value={d.budget} onChange={(budget) => setCreateDraft({ ...d, budget:Number(budget) })}/><FormInput label="Lock fee" type="number" value={d.fee} onChange={(fee) => setCreateDraft({ ...d, fee:Number(fee) })}/><FormInput label="对参与者的期待" area value={d.expectation} onChange={(expectation) => setCreateDraft({ ...d, expectation })}/><div className="sheet-actions"><Button onClick={() => setCreateStep(1)}>返回</Button><Button kind="primary" onClick={() => setCreateStep(3)}>生成 Date Plan</Button></div></section>}{createStep === 3 && <section className="card form"><p className="eyebrow">Date Plan · 由 Host 最终确认</p><div className="plan"><span>✦</span><h2>{d.title}</h2><p>{d.content}</p></div><div className="timeline"><p><b>{d.time}</b><br/><span>在 {d.location} 附近集合</span></p><p><b>{d.content}</b><br/><span>预算约 ¥{d.budget} · AA · Lock fee ¥{d.fee}</span></p><p><b>自然结束</b><br/><span>安全离开永远优先，不需要勉强续场。</span></p></div><div className="notice"><b>发布前再确认一次</b><br/>精确集合点仅在 Guest Lock 成功后开放；你仍需手动同意每一份 Apply。</div><div className="sheet-actions"><Button onClick={() => setCreateStep(2)}>返回修改</Button><Button kind="primary" onClick={() => { const next = { id:`d${Date.now()}`, host:me, mode:d.mode, title:d.title, cover:'custom', vibe:d.vibe, content:d.content, description:d.description, time:d.time, location:d.location, exact:'创建后补充精确集合点', budget:d.budget, payment:'AA', lockFee:d.fee, refund:'活动开始前 24 小时可退', expectation:d.expectation, capacity:d.capacity, attendees:[], status:'招募中' }; setDates([next, ...dates]); setCreateStep(1); say('Date 已发布，等待你手动审核 Apply'); go('my'); }}>发布这场 Date</Button></div></section>}</Layout>; }
  function Stepper({ step }) { return <div className="stepper">{[1,2,3].map((item) => <><i className={item <= step ? 'active' : ''} key={`i${item}`}>{item}</i>{item < 3 && <span key={`s${item}`}/>}</>)}</div>; }
  function FormInput({ label, area, value, onChange, type = 'text' }) { return <label>{label}{area ? <textarea value={value} onChange={(e) => onChange(e.target.value)}/> : <input type={type} value={value} onChange={(e) => onChange(e.target.value)}/>}</label>; }
  function Edit({ date }) { const [draft, setDraft] = useState({ description:date.description, time:date.time, location:date.location, budget:date.budget, lockFee:date.lockFee }); const important = draft.time !== date.time || draft.location !== date.location || Number(draft.budget) !== date.budget || Number(draft.lockFee) !== date.lockFee; return <Layout title="修改 Date" back bare><section className="card form"><p className="eyebrow">硬规则会判断变更等级</p><h2>{date.title}</h2><div className={`notice ${important ? 'warning' : ''}`}><b>{important ? '重要修改' : '简单修改'}</b><br/>{important ? '时间、地点、预算或 Lock fee 已改变。已确认 Guest 会进入「待重新确认」，默认勾选通知和退出 / 退款路径。' : '仅修改活动描述时，向已申请 / 已确认用户发送轻提示。'}</div><FormInput label="活动描述" area value={draft.description} onChange={(description) => setDraft({ ...draft, description })}/><FormInput label="时间" value={draft.time} onChange={(time) => setDraft({ ...draft, time })}/><FormInput label="区域" value={draft.location} onChange={(location) => setDraft({ ...draft, location })}/><FormInput label="预算" type="number" value={draft.budget} onChange={(budget) => setDraft({ ...draft, budget })}/><FormInput label="Lock fee" type="number" value={draft.lockFee} onChange={(lockFee) => setDraft({ ...draft, lockFee })}/><label className="check"><input type="checkbox" checked readOnly/>默认通知所有已申请 / 已 Lock 用户</label><Button kind="primary" className="full" onClick={() => { updateDate(date.id, { ...draft, budget:Number(draft.budget), lockFee:Number(draft.lockFee), status:important ? '待重新确认' : date.status }); addNotice(important ? 'Date 有重要变更，请重新确认' : 'Date 描述已更新', important ? '请确认新安排、退出或申请退款。' : 'Host 更新了活动描述。', date.id); say(important ? '重要修改已发布，已确认 Guest 待重新确认' : '描述已更新，已发送轻提示'); go('detail',{dateId:date.id}); }}>发布修改</Button></section></Layout>; }
  function Invite({ date }) {
    const host = people[date.host];
    const ticketId = `DIVE-${String(date.id).toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
    const qrCells = Array.from({ length:81 }, (_, index) => {
      const row = Math.floor(index / 9);
      const col = index % 9;
      const finder = (row < 3 && col < 3) || (row < 3 && col > 5) || (row > 5 && col < 3);
      const active = finder || ((index * 7 + date.title.length + ticketId.length) % 5 < 2);
      return <i className={active ? 'on' : ''} key={index}/>;
    });
    return <Layout title="Dive Invite" back bare><section className="invite-shell">
      <p className="eyebrow">LOCK FEE PAID</p>
      <h1>Your Dive invitation</h1>
      <article className="invite-ticket" aria-label={`${date.title} invitation ticket`}>
        <div className="ticket-cut top"/>
        <div className="ticket-cut bottom"/>
        <section className="ticket-qr-panel">
          <div className="ticket-brand"><img src="/dive-plan-icon.png" alt="Dive"/></div>
          <div className="ticket-qr" aria-hidden="true">{qrCells}<b>D</b></div>
          <p>Show this invite after the Lock fee is confirmed.</p>
        </section>
        <section className="ticket-info-panel">
          <div className="ticket-status"><span>已支付 Lock fee</span><b>¥{date.lockFee || 0}</b></div>
          <h2>{date.title}</h2>
          <p>{date.content}</p>
          <div className="ticket-meta-grid">
            <span><b>DATE</b><small>{date.time}</small></span>
            <span><b>PLACE</b><small>{date.exact || date.location}</small></span>
            <span><b>HOST</b><small>{host?.name || 'Host'}</small></span>
            <span><b>GUEST</b><small>{people.vivi.name}</small></span>
          </div>
          <div className="ticket-footer">
            <span>{ticketId}</span>
            <small>{date.payment} · {modeName[date.mode]}</small>
          </div>
        </section>
      </article>
      <Button kind="primary" className="full invite-im-button" onClick={() => newChat(date.host, date.id)}>进入活动 IM</Button>
    </section></Layout>;
  }
  function IM() {
    const priorityOptions = [['activity','活动优先'], ['host','我是 Host 优先'], ['guest','我是 Guest 优先']];
    const onlyOptions = [['activity','仅看活动'], ['host','仅看我是 Host'], ['guest','仅看我是 Guest']];
    const hasActivity = (chat) => Boolean(chatContext(chat));
    const qualifies = (chat) => !imOnly || (imOnly === 'activity' ? hasActivity(chat) : chatRole(chat) === imOnly);
    const priorityScore = (chat) => { if (!imPriority) return 0; if (imPriority === 'activity') return hasActivity(chat) ? (chatContext(chat)?.status === '招募中' || chatContext(chat)?.status === '已 Lock' ? 2 : 1) : 0; return chatRole(chat) === imPriority ? 2 : 0; };
    const visibleChats = chats.filter(qualifies).sort((a,b) => Number(b.pinned) - Number(a.pinned) || priorityScore(b) - priorityScore(a) || (b.updatedAt || 0) - (a.updatedAt || 0));
    return <Layout title="消息"><section className="im-page im-v2"><div className="im-toolbar"><div><p className="im-kicker">围绕真实活动的对话</p><h2>消息</h2></div><button className="im-search-toggle" onClick={() => go('im-search')} aria-label="搜索聊天">⌕</button></div><div className="conversation-title"><span>{visibleChats.length ? '你的活动对话' : '暂时没有会话'}</span></div>{visibleChats.length ? <div className="conversation-list">{visibleChats.map((chat) => <ConversationRow chat={chat} key={chat.id}/>)}</div> : <Empty title="还没有消息" copy="从一场活动开始认识别人。" action="去看活动" onClick={() => go('discover')}/>}<button className="im-discover-nudge" onClick={() => go('discover')}><span>✦</span><b>从一场具体的 Date 开始聊天</b><i>›</i></button></section></Layout>;
  }

  function ConversationRow({ chat, search = false }) {
    const context = chatContext(chat);
    const person = people[chat.with];
    const last = lastMessage(chat);
    const title = chat.type === 'group' ? chat.name : person?.name;
    return <article className={`conversation-row ${chat.pinned ? 'pinned' : ''}`}><button className="conversation-main" onClick={() => { markChatRead(chat.id); go('chat', { chatId:chat.id }); }}><span className={chat.type === 'group' ? 'avatar group-avatar' : ''}>{chat.type === 'group' ? '◎' : <Avatar id={chat.with}/>}</span><span className="conversation-copy"><b>{title} {chat.pinned && <em>📌</em>}</b><small className="conversation-activity">{context ? context.title : '暂无共同活动'}</small><small>{messageSummary(last)}</small></span><span className="conversation-meta"><time>{chat.updatedAt > 1000 ? '刚刚' : chat.updatedAt > 180 ? '2 min' : chat.updatedAt > 90 ? '1 h' : '昨天'}</time>{chat.unread > 0 && <i>{chat.unread}</i>}</span></button>{!search && <button className="conversation-more" onClick={() => setChatActionId(chat.id)} aria-label="会话操作">•••</button>}</article>;
  }

  function Chat({ chat }) {
    const [text,setText] = useState('');
    const [reactionTarget,setReactionTarget] = useState(null);
    useEffect(() => { markChatRead(chat.id); }, [chat.id]);
    const context = chatContext(chat);
    const other = people[chat.with];
    const otherRole = context?.host === chat.with ? 'Host' : 'Guest';
    return <Layout title={chat.type === 'group' ? chat.name : other?.name} back bare><section className="chat-v2"><section className="chat-identity"><button onClick={() => go('profile', { userId:chat.with })}>{chat.type === 'group' ? <span className="avatar group-avatar">◎</span> : <Avatar id={chat.with}/>}<span><b>{chat.type === 'group' ? chat.name : other?.name}</b><small>{chat.type === 'group' ? '活动群聊' : '活动关系中的 1v1 对话'}</small></span></button><button onClick={() => setChatActionId(chat.id)} aria-label="更多会话操作">•••</button></section>{context && <section className="shared-context"><button className="shared-context-main" onClick={() => go('detail',{dateId:context.id})}><p>你们近期共同参与</p><b>{context.title}</b><small>{context.time} · {context.location}</small><span>{other?.name || '对方'} 是本活动的 {otherRole}</span><i>查看活动 ›</i></button><button className="context-forward" onClick={() => forwardActivity(chat.id,context.id)} aria-label="转发当前活动卡">↗</button>{chat.dateIds.length > 1 && <button className="context-switch" onClick={() => setContextPickerId(chat.id)}>⌄</button>}</section>}<div className="messages chat-messages">{chat.messages.map((message,index) => <MessageBubble key={`${message.type}-${index}`} message={message} chat={chat} reactionOpen={reactionTarget === index} onReactionOpen={() => setReactionTarget(reactionTarget === index ? null : index)} onReact={(emoji) => { toggleMessageReaction(chat.id,index,emoji); setReactionTarget(null); }} onForward={(dateId) => forwardActivity(chat.id,dateId)}/>)}</div><form className="message-input message-input-v2" onSubmit={(event) => { event.preventDefault(); postMessage(chat.id,text); setText(''); }}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="输入消息……"/><button className="send-message" aria-label="发送消息">↑</button><button className="plus-message" type="button" onClick={() => setChatPlusId(chat.id)} aria-label="更多消息类型">＋</button></form></section></Layout>;
  }

  function MessageReactions({ reactions = [], open, onOpen, onReact }) { return <div className="message-reactions">{reactions.map((reaction) => <button className={reaction.mine ? 'selected' : ''} onClick={() => onReact(reaction.emoji)} key={reaction.emoji} aria-label={`回应 ${reaction.emoji}`}>{reaction.emoji}<small>{reaction.count}</small></button>)}<button className="reaction-add" onClick={onOpen} aria-label="添加表情回应">☺</button>{open && <span className="reaction-picker" role="group" aria-label="选择表情回应">{['💜','✨','😂','👀'].map((emoji) => <button onClick={() => onReact(emoji)} key={emoji}>{emoji}</button>)}</span>}</div>; }
  function MessageBubble({ message, chat, reactionOpen, onReactionOpen, onReact, onForward }) {
    const reactions = <MessageReactions reactions={message.reactions} open={reactionOpen} onOpen={onReactionOpen} onReact={onReact}/>;
    if (message.type === 'image') return <article className={`message-bubble media ${message.mine ? 'mine' : ''}`}>{!message.mine && <button onClick={() => go('profile',{userId:chat.with})}><Avatar id={chat.with} small/></button>}<div className="message-stack"><img src={message.url} alt="聊天图片"/>{reactions}</div><time>{message.time}</time></article>;
    if (message.type === 'activity') { const date = currentDate(message.dateId); if (!date) return null; return <article className={`message-bubble activity-message ${message.mine ? 'mine' : ''}`}>{!message.mine && <button onClick={() => go('profile',{userId:chat.with})}><Avatar id={chat.with} small/></button>}<div className="message-stack"><button className="message-activity-card" onClick={() => go('detail',{dateId:date.id})}><span>{date.cover === 'flowers' ? '✿' : '✦'}</span><div><b>{date.title}</b><small>{date.time} · {date.location}</small><small>{date.mode === 'one' ? '2 人' : `${date.capacity} 人`}</small></div><i>查看活动 ›</i></button><div className="activity-message-actions"><button onClick={() => onForward(date.id)}>↗ 转发</button>{reactions}</div></div><time>{message.time}</time></article>; }
    return <article className={`message-bubble ${message.mine ? 'mine' : ''}`}>{!message.mine && <button onClick={() => go('profile',{userId:chat.with})}><Avatar id={chat.with} small/></button>}<div className="message-stack"><span className="message-text">{message.text}</span>{reactions}</div><time>{message.time}</time></article>;
  }
  function ProfileV2({ userId }) { const profileId = userId || me; const user = people[profileId]; const mine = profileId === me; const joined = dates.filter((date) => date.attendees.includes(profileId)).length; const hosted = dates.filter((date) => date.host === profileId).length; const visibleMemories = memory.length ? memory : [null, null, null]; return <Layout title={mine ? 'Profile' : user.name} back={!mine}><section className="profile-scene"><div className="profile-orb one"/><div className="profile-orb two"/><div className="profile-avatar"><Avatar id={profileId}/></div><span className="handle">@{user.name.toLowerCase()}</span>{mine && <button className="profile-edit" onClick={() => go('onboarding')}>Edit Profile</button>}</section><section className="profile-glass"><div className="glass-grip"/><div className="profile-title"><div><h2>{user.name}<small> · {user.age}</small></h2><span>{user.city} · {user.intent}</span></div><button className="star-button">✦</button></div><p className="profile-intro">{user.intro}</p><div className="profile-stats"><span><b>{joined}</b><small>参与</small></span><span><b>{hosted}</b><small>发起</small></span><span><b>{memory.length}</b><small>活动照片</small></span></div><div className="pills">{user.interests.map((interest) => <Pill key={interest}>{interest}</Pill>)}</div><div className="profile-memory-strip">{visibleMemories.map((url,index) => url ? <img src={url} key={index}/> : <span key={index} className={`memory-placeholder p${index}`}>活动<br/>照片</span>)}<button onClick={() => go('feedback')} className="memory-more">＋</button></div><p className="profile-note">Dating 意图：{user.intent} · 只展示公开活动记忆</p></section>{mine && <section className="profile-actions"><Button onClick={() => go('onboarding')}>✎ 编辑 Dating Profile</Button><Button onClick={() => go('feedback')}>活动后反馈</Button></section>}<section className="block profile-history"><div className="heading"><h3>我的 Date 历史</h3><span>只显示已确认 / 已结束</span></div>{dates.filter((date) => date.host === profileId || date.attendees.includes(profileId)).slice(0,3).map((date) => <button key={date.id} onClick={() => go('detail',{dateId:date.id})}><span>{date.cover === 'flowers' ? '✿' : '✦'}</span><div><b>{date.title}</b><small>{date.time} · {modeName[date.mode]} · {date.status}</small></div><i>›</i></button>)}</section></Layout>; }
  function Profile({ userId }) { const user = people[userId || me]; const mine = (userId || me) === me; return <Layout title={mine ? 'Profile' : user.name} back={!mine}><section className="profile-card"><Avatar id={userId || me}/><div><h2>{user.name} · {user.age}</h2><p>{user.city} · {user.intent}</p></div></section><section className="block"><h3>关于我</h3><p>{user.intro}</p><div className="pills">{user.interests.map((interest) => <Pill tone="accent" key={interest}>{interest}</Pill>)}</div></section><section className="block"><div className="heading"><h3>活动照片</h3><span>仅公开的活动记忆</span></div>{memory.length ? <div className="memory-grid">{memory.map((url,index) => <img src={url} key={index}/>)}</div> : <p className="muted">还没有公开的活动照片。</p>}</section>{mine && <section className="action-stack"><Button onClick={() => go('onboarding')}>✎ 编辑 Dating Profile</Button><Button onClick={() => go('feedback')}>活动后反馈</Button></section>}</Layout>; }
  function Onboarding() { const [step,setStep]=useState(1); return <Layout title="Dating Profile" back bare><Stepper step={step}/><section className="card form"><p className="eyebrow">{step} / 3</p><img className="onboard-logo" src="/dive-plan-icon.png" alt="Dive"/>{step===1 && <><h2>先让人认识真实的你</h2><FormInput label="昵称" value="Vivi" onChange={() => {}}/><FormInput label="城市" value="上海" onChange={() => {}}/><FormInput label="一句自我介绍" area value="喜欢把周末过成一张小小的邀请函。" onChange={() => {}}/></>}{step===2 && <><h2>你现在期待什么？</h2><ChoiceGroup label="Dating 意图" values={['认真恋爱','想认识一个特别的人','顺其自然看感觉','先一起出去玩']} selected={['想认识一个特别的人']} onClick={() => {}}/><ChoiceGroup label="个人标签" values={['独立电影','散步','烘焙','书店','爵士','摄影']} selected={['独立电影','散步','烘焙']} multi onClick={() => {}}/></>}{step===3 && <><h2>你愿意怎样开始认识？</h2><ChoiceGroup label="至少 3 个活动类型" values={['展览','书店','咖啡','徒步','吃饭','音乐']} selected={['展览','书店','咖啡']} multi onClick={() => {}}/><ChoiceGroup label="人数偏好" values={['1v1','3–5 人 Small Date','都可以']} selected={['都可以']} onClick={() => {}}/></>}<div className="sheet-actions">{step > 1 && <Button onClick={() => setStep(step - 1)}>返回</Button>}<Button kind="primary" onClick={() => step < 3 ? setStep(step + 1) : (say('Your Dive is ready'),go('discover'))}>{step < 3 ? '下一步' : '完成，开始探索'}</Button></div></section></Layout>; }
  function Feedback() { const date=currentDate('d4'); const [photos,setPhotos] = useState([]); function pick(e){ const files=[...e.target.files].slice(0,9); Promise.all(files.map((file)=>new Promise((resolve)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.readAsDataURL(file); }))).then((urls)=>setPhotos(urls)); } return <Layout title="活动后" back><section className="date-summary"><b>{date.title}</b><span>{date.time} · 已结束</span></section><div className="feedback-tabs"><button className={feedbackTab==='rating'?'active':''} onClick={()=>setFeedbackTab('rating')}>三问评价</button><button className={feedbackTab==='host'?'active':''} onClick={()=>setFeedbackTab('host')}>给 Host 反馈</button><button className={feedbackTab==='connection'?'active':''} onClick={()=>setFeedbackTab('connection')}>双向续联</button></div>{feedbackTab==='rating' && <section className="card form"><p className="eyebrow">P0 三问 · 可跳过</p><h2>这场 Date 感觉如何？</h2><Select label="活动体验" options={['很好','还不错','一般','不太符合预期']}/><Select label="还愿意参加类似的 Date 吗？" options={['愿意','可以再看看','暂不']}/><Select label="还愿意继续认识活动里的人吗？" options={['愿意','可以再聊聊','暂不']}/><Button kind="primary" className="full" onClick={()=>{setFeedbackSent({...feedbackSent,rating:true});say('评价已完成')}}>{feedbackSent.rating?'已完成':'完成评价'}</Button></section>}{feedbackTab==='host' && <section className="card form"><p className="eyebrow">私密发送给 Host</p><h2>给这场 Date 一点反馈</h2><div className="notice"><b>不是 Dating 评价</b><br/>提交后会以私密消息发送到你与 Host 的活动 IM。</div><Select label="与描述相符吗？" options={['很符合','基本符合','不太符合']}/><label>想对 Host 说<textarea placeholder="可选，友好且具体的反馈会更有帮助。"/></label><Button kind="primary" className="full" onClick={()=>{setFeedbackSent({...feedbackSent,host:true});say('已私密发送给 Host')}}>{feedbackSent.host?'已发送':'私密发送给 Host'}</Button></section>}{feedbackTab==='connection' && <section className="card form"><p className="eyebrow">Dating 双向续联</p><h2>只由双方选择决定下一步</h2><div className="notice"><b>仅系统可见</b><br/>不会向对方展示单方选择。只有双方对「愿意再见」或「愿意继续聊天」互选后才解锁下一步。</div><div className="person-card"><Avatar id="jun"/><span>Jun · 本场 1v1 Date 对象</span></div><Select label="本次相处舒适度" options={['5 · 很舒服','4 · 不错','3 · 一般','2 · 有点不适','1 · 不舒服']}/><Select label="是否愿意再见" options={['愿意','可以再聊聊','不继续']}/><Select label="是否愿意继续私聊" options={['愿意','暂不']}/><Select label="是否愿意互相公开联系方式" options={['愿意','暂不']}/><Button kind="primary" className="full" onClick={()=>{setFeedbackSent({...feedbackSent,connection:true});say('私密选择已保存；单方选择不会对外展示')}}>{feedbackSent.connection?'已保存':'提交私密选择'}</Button></section>}<section className="card form memory-form"><p className="eyebrow">活动记忆 · 最多 9 张</p><h2>留下一点那天的样子</h2><div className="notice">公开的照片会展示在你的 Profile 照片专区，并链接回这场 Date；不会包含参与者名单、评分或私密地点。</div><label className="upload">＋<input type="file" accept="image/*" multiple onChange={pick}/><small>上传活动记忆</small></label>{photos.length ? <><div className="memory-grid">{photos.map((photo,index)=><img src={photo} key={index}/>)}</div><Button kind="primary" className="full" onClick={()=>{setMemory(photos);say('活动记忆已保存，公开照片已展示在 Profile')}}>保存活动记忆</Button></> : null}</section></Layout>; }
  function Select({ label, options }) { return <label>{label}<select>{options.map((option)=><option key={option}>{option}</option>)}</select></label>; }

  function IMSearch() {
    const [query, setQuery] = useState('');
    const keyword = query.trim().toLowerCase();
    const results = keyword ? chats.filter((chat) => { const name = (chat.type === 'group' ? chat.name : people[chat.with]?.name || '').toLowerCase(); const activities = chat.dateIds.map((id) => currentDate(id)?.title || '').join(' ').toLowerCase(); return name.includes(keyword) || activities.includes(keyword); }) : chats;
    return <Layout title="搜索聊天" back bare><section className="im-search-page"><div className="im-search-field"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索昵称 / 活动名称"/></div><div className="search-result-heading"><b>{keyword ? '搜索结果' : '最近会话'}</b><small>{results.length} 个会话</small></div><div className="conversation-list">{results.map((chat) => <ConversationRow chat={chat} search key={chat.id}/>)}</div>{keyword && !results.length && <Empty title="没有找到相关聊天" copy="试试昵称或完整活动名称。" action="清除搜索" onClick={() => setQuery('')}/>}</section></Layout>;
  }

  function ActivityPicker({ chatId }) {
    const recentDates = dates.filter((date) => (date.host === me || date.attendees.includes(me)) && date.status !== '已取消').filter((date) => !date.expired);
    return <Layout title="转发活动" back bare><section className="activity-picker"><p className="eyebrow">ACTIVITY FORWARD</p><h2>转发一场活动</h2><p className="muted">只展示你近期参与或发起的活动；对方可点开查看详情。</p>{recentDates.length ? <div className="activity-picker-list">{recentDates.map((date) => <button key={date.id} onClick={() => { forwardActivity(chatId, date.id); goBack(); }}><span>{date.cover === 'flowers' ? '✿' : date.cover === 'books' ? '▤' : '✦'}</span><div><b>{date.title}</b><small>{date.time}</small><small>{date.location} · {date.mode === 'one' ? '2 人' : `${date.capacity} 人`}</small></div><i>转发 ›</i></button>)}</div> : <Empty title="没有可转发的近期活动" copy="参与或发起一场活动后，可以把它分享给对方。" action="去看活动" onClick={() => go('discover')}/>}</section></Layout>;
  }

  function ChatActionSheet({ chat }) { if (!chat) return null; return <Sheet close={() => setChatActionId(null)}><section className="chat-action-sheet"><p className="eyebrow">CONVERSATION</p><h2>{chat.type === 'group' ? chat.name : people[chat.with]?.name}</h2><Button className="full" onClick={() => { toggleChatPin(chat.id); setChatActionId(null); say(chat.pinned ? '已取消置顶' : '会话已置顶'); }}>{chat.pinned ? '取消置顶' : '📌 置顶会话'}</Button><p className="muted">置顶会话会始终显示在消息列表顶部。</p></section></Sheet>; }

  function ContextPickerSheet({ chat }) { if (!chat) return null; return <Sheet close={() => setContextPickerId(null)}><section className="context-picker"><p className="eyebrow">SHARED DATES</p><h2>选择活动上下文</h2>{chat.dateIds.map((id) => { const date = currentDate(id); const selected = chat.contextDateId === id; return <button className={selected ? 'selected' : ''} key={id} onClick={() => { setChatContext(chat.id,id); setContextPickerId(null); }}><i>{selected ? '●' : '○'}</i><span><b>{date.title}</b><small>{date.time} · {date.location}</small></span></button>; })}</section></Sheet>; }

  function ChatPlusSheet({ chatId }) {
    const pickImage = (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { setImagePreview({ chatId, url:reader.result }); setChatPlusId(null); }; reader.readAsDataURL(file); };
    return <Sheet close={() => setChatPlusId(null)}><section className="chat-plus-sheet"><div><label><span>▧</span><b>图片</b><input type="file" accept="image/*" onChange={pickImage}/></label><button onClick={() => { setChatPlusId(null); go('activity-picker',{chatId}); }}><span>↗</span><b>转发活动</b></button></div><Button className="full" onClick={() => setChatPlusId(null)}>取消</Button></section></Sheet>;
  }

  function ImagePreviewSheet() { if (!imagePreview) return null; return <Sheet close={() => setImagePreview(null)}><section className="image-preview-sheet"><p className="eyebrow">IMAGE PREVIEW</p><img src={imagePreview.url} alt="待发送图片"/><div className="sheet-actions"><Button onClick={() => setImagePreview(null)}>取消</Button><Button kind="primary" onClick={() => { postMessage(imagePreview.chatId,{ type:'image', url:imagePreview.url }); setImagePreview(null); say('图片已发送'); }}>发送图片</Button></div></section></Sheet>; }

  function ProfilePhoto({ photo, className = '' }) {
    const uploaded = photo?.startsWith?.('data:') || photo?.startsWith?.('blob:');
    const hasImage = uploaded || photo?.startsWith?.('/profile-avatars/');
    return <span className={`profile-photo ${hasImage ? 'uploaded' : `photo-${photo || 'portrait'}`} ${className}`}>{hasImage ? <img src={photo} alt="Profile 照片"/> : <i>{photo === 'coffee' ? '☕' : photo === 'city' ? '✦' : photo?.startsWith?.('moment') ? '◌' : 'V'}</i>}</span>;
  }

  function ProfileHome() {
    const data = activeProfile;
    const joined = dates.filter((date) => date.attendees.includes(me) && date.status !== '已取消').length;
    const hosted = dates.filter((date) => date.host === me).length;
    const completed = dates.filter((date) => date.status === '已结束' && (date.host === me || date.attendees.includes(me))).length;
    const items = [
      ['◐', '编辑 Profile', '照片、资料和 Dating 偏好', beginProfileEdit],
      ['◷', '个人历史', '已参与与已发起的 Date', () => go('profile-history')],
      ['⌁', '隐私设置', '决定公开资料的展示范围', () => go('privacy')],
      ['◌', '通知设置', '管理活动和消息提醒', () => go('notification-settings')]
    ];
    return <Layout title="我的"><section className="profile-home"><button className="profile-settings" onClick={() => go('privacy')} aria-label="隐私设置">⚙</button><div className="profile-home-portrait"><ProfilePhoto photo={data.photos[0]}/></div><p className="profile-home-handle">{data.handle}</p><h2>{data.name} <small>· {data.age}</small></h2><p className="profile-home-city">{data.city}</p><Button className="profile-preview-button" onClick={() => go('public-profile', { userId:me })}>预览我的公开 Profile <span>›</span></Button><section className="profile-stat-card glass-strong"><p>我的 Dive 数据</p><div><span><b>{joined}</b><small>参与</small></span><span><b>{hosted}</b><small>发起</small></span><span><b>{completed}</b><small>完成</small></span></div></section><section className="profile-menu">{items.map(([icon,title,copy,onClick]) => <button key={title} onClick={onClick}><span>{icon}</span><div><b>{title}</b><small>{copy}</small></div><i>›</i></button>)}</section></section></Layout>;
  }

  function PublicProfile({ userId }) {
    const data = profileFor(userId);
    const [photoIndex, setPhotoIndex] = useState(0);
    const photos = data.photos?.length ? data.photos : ['portrait'];
    const moments = [...(data.moments || []), ...(userId === me ? memory.map((photo) => ({ photo, copy:'一场被公开的活动记忆。' })) : [])];
    const basics = [data.height, data.zodiac, data.education, data.privacy?.work && data.work, data.privacy?.income && data.income].filter(Boolean);
    const movePhoto = (direction) => setPhotoIndex((current) => (current + direction + photos.length) % photos.length);
    return <Layout title={userId === me ? '我的公开 Profile' : data.name} back bare><section className="public-profile"><section className="public-photo-stage"><ProfilePhoto photo={photos[photoIndex]} className="public-photo-fill"/>{photos.length > 1 && <><div className="photo-dots">{photos.map((_, item) => <i key={item} className={item === photoIndex ? 'active' : ''}/>)}</div><div className="photo-arrows"><button onClick={() => movePhoto(-1)} aria-label="上一张照片">←</button><button onClick={() => movePhoto(1)} aria-label="下一张照片">→</button></div></>}</section><article className="public-glass"><div className="glass-grip"/><p className="public-handle">{data.handle}</p><h2>{data.name}<small> · {data.age}</small></h2><p className="public-city">{data.city}</p>{basics.length > 0 && <p className="public-basics">{basics.join(' · ')}</p>}{data.tags?.length > 0 && <div className="public-tags">{data.tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}</div>}<p className="public-intro">{data.intro}</p></article><section className="public-content">{data.intent && <ProfileSection title="我现在期待"><p className="intent-line">✦ {data.intent}</p></ProfileSection>}{data.mbti && <ProfileSection title="MBTI"><p className="feature-value">{data.mbti}</p></ProfileSection>}{data.styles?.length > 0 && <ProfileSection title="Dating 时的我"><div className="dating-style-list">{data.styles.map((style) => <article key={style.title}><span>{style.icon}</span><div><b>{style.title}</b><p>{style.copy}</p></div></article>)}</div></ProfileSection>}{data.activities?.length > 0 && <ProfileSection title="我喜欢的活动"><div className="activity-tag-list">{data.activities.map((activity) => <span key={activity}>✦ {activity}</span>)}</div></ProfileSection>}{data.voice && <ProfileSection title="我的声音"><button className="voice-player" onClick={() => say('原型演示：声音播放')}><b>▶</b> {data.voice}</button></ProfileSection>}{moments.length > 0 && <ProfileSection title="关于我的几个瞬间"><div className="moment-list">{moments.map((moment,index) => <article key={`${moment.copy}-${index}`}><ProfilePhoto photo={moment.photo} className="moment-photo"/><p>{moment.copy}</p></article>)}</div></ProfileSection>}</section></section></Layout>;
  }

  function ProfileSection({ title, children }) { return <section className="public-section"><h3>{title}</h3>{children}</section>; }

  function EditProfile() {
    const data = profileDraft || activeProfile;
    const rows = [
      ['photos', '照片', `${data.photos?.length || 0} 张照片`], ['basic', '基础资料', `${data.name} · ${data.height || '待填写'}`], ['tags', '我的标签', data.tags?.join(' / ') || '待填写'], ['mbti', 'MBTI', data.mbti || '未填写'], ['dating', 'Dating 偏好', data.intent || '待填写'], ['styles', 'Dating Style', data.styles?.map((item) => item.title).join(' / ') || '待填写'], ['activities', '喜欢的活动', data.activities?.join(' / ') || '待填写'], ['people', '活动人数偏好', data.peoplePreference || '待填写'], ['availability', '可参加时间', data.availability?.join(' / ') || '待填写'], ['voice', '我的声音', data.voice ? `语音 ${data.voice}` : '未添加'], ['moments', '关于我的几个瞬间', `${data.moments?.length || 0} 个瞬间`]
    ];
    return <Layout title="编辑 Profile" back bare onBack={leaveProfileEdit}><section className="edit-profile"><p className="edit-profile-intro">修改后点击保存，会立即同步到公开 Profile。</p><section className="edit-profile-list">{rows.map(([id,title,value]) => <button key={id} onClick={() => go('profile-editor', { sectionId:id })}><span>{id === 'photos' ? '▧' : id === 'voice' ? '◉' : '◌'}</span><div><b>{title}</b><small>{value}</small></div><i>›</i></button>)}</section><Button kind="primary" className="full profile-save" onClick={saveProfile}>保存</Button></section></Layout>;
  }

  function ProfileEditor({ sectionId }) {
    const data = profileDraft || activeProfile;
    const setList = (key, value) => updateProfileDraft({ [key]: value });
    const toggleItem = (key, item, maximum = 5) => { const list = data[key] || []; setList(key, list.includes(item) ? list.filter((value) => value !== item) : list.length < maximum ? [...list, item] : list); };
    const title = { photos:'照片', basic:'基础资料', tags:'我的标签', mbti:'MBTI', dating:'Dating 偏好', styles:'Dating Style', activities:'喜欢的活动', people:'活动人数偏好', availability:'可参加时间', voice:'我的声音', moments:'关于我的几个瞬间' }[sectionId];
    const pickPhotos = (event) => { const files = [...event.target.files].slice(0, Math.max(0, 6 - (data.photos?.length || 0))); Promise.all(files.map((file) => new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }))).then((photos) => setList('photos', [...data.photos, ...photos])); };
    const content = () => {
      if (sectionId === 'photos') return <><p className="muted">第一张始终为头像。最多 6 张，非头像照片可删除。</p><div className="photo-editor-grid">{data.photos.map((photo,index) => <article key={`${photo}-${index}`}><ProfilePhoto photo={photo}/>{index === 0 ? <small>主头像</small> : <button onClick={() => setList('photos', data.photos.filter((_, item) => item !== index))}>×</button>}</article>)}{data.photos.length < 6 && <label className="photo-add">＋<input type="file" accept="image/*" multiple onChange={pickPhotos}/><small>添加照片</small></label>}</div></>;
      if (sectionId === 'basic') return <><FormInput label="昵称" value={data.name} onChange={(name) => updateProfileDraft({ name })}/><FormInput label="现居城市" value={data.city} onChange={(city) => updateProfileDraft({ city })}/><FormInput label="身高" value={data.height} onChange={(height) => updateProfileDraft({ height })}/><label>星座<select value={data.zodiac} onChange={(event) => updateProfileDraft({ zodiac:event.target.value })}>{['双鱼座','白羊座','狮子座','天秤座','摩羯座'].map((item) => <option key={item}>{item}</option>)}</select></label><label>学历<select value={data.education} onChange={(event) => updateProfileDraft({ education:event.target.value })}>{['本科','硕士','博士','其他'].map((item) => <option key={item}>{item}</option>)}</select></label><FormInput label="工作" value={data.work} onChange={(work) => updateProfileDraft({ work })}/><label>关于我<textarea value={data.intro} onChange={(event) => updateProfileDraft({ intro:event.target.value })}/></label></>;
      if (sectionId === 'tags') return <ChoiceGroup label="选择 1–5 个标签" values={['慢热','浪漫主义','喜欢深聊','爱旅行','好奇','爱运动','电影控','不赶时间']} selected={data.tags || []} multi onClick={(item) => toggleItem('tags', item)}/>;
      if (sectionId === 'mbti') return <><label>MBTI<select value={data.mbti} onChange={(event) => updateProfileDraft({ mbti:event.target.value })}><option value="">不展示</option>{['ENFP','INFP','INFJ','ENTP','ISFJ','INTJ'].map((item) => <option key={item}>{item}</option>)}</select></label><p className="muted">清空后，公开 Profile 不展示 MBTI 模块。</p></>;
      if (sectionId === 'dating') return <ChoiceGroup label="我现在期待" values={['认真恋爱','想认识一个特别的人','顺其自然看感觉','先一起出去玩']} selected={[data.intent]} onClick={(intent) => updateProfileDraft({ intent })}/>;
      if (sectionId === 'styles') return <><p className="muted">最多展示 2 个 Dating Style。</p>{data.styles.map((style,index) => <section className="editor-style" key={`${style.title}-${index}`}><span>{style.icon}</span><div><FormInput label="标题" value={style.title} onChange={(value) => setList('styles', data.styles.map((item,position) => position === index ? { ...item, title:value } : item))}/><FormInput label="描述" value={style.copy} onChange={(value) => setList('styles', data.styles.map((item,position) => position === index ? { ...item, copy:value } : item))}/></div><button onClick={() => setList('styles', data.styles.filter((_,position) => position !== index))}>×</button></section>)}{data.styles.length < 2 && <Button onClick={() => setList('styles', [...data.styles, { icon:'✦', title:'新的相处方式', copy:'用一句话描述自己。' }])}>＋ 添加 Dating Style</Button>}</>;
      if (sectionId === 'activities') return <ChoiceGroup label="我喜欢的活动" values={['Coffee','City Walk','Livehouse','展览','户外','书店','烘焙','电影']} selected={data.activities || []} multi onClick={(item) => toggleItem('activities', item)}/>;
      if (sectionId === 'people') return <ChoiceGroup label="活动人数偏好" values={['偏好 1v1 Date','偏好 Small Date','1v1 与 Small Date 都可以']} selected={[data.peoplePreference]} onClick={(peoplePreference) => updateProfileDraft({ peoplePreference })}/>;
      if (sectionId === 'availability') return <ChoiceGroup label="通常可参加的时间" values={['工作日晚上','周六上午','周六下午','周日傍晚','可灵活约']} selected={data.availability || []} multi onClick={(item) => toggleItem('availability', item, 5)}/>;
      if (sectionId === 'voice') return <><section className="voice-editor"><span>◉</span><div><b>{data.voice ? `已添加 ${data.voice}` : '还没有声音介绍'}</b><small>公开 Profile 中会显示一个轻量播放入口。</small></div></section>{data.voice ? <Button kind="danger" className="full" onClick={() => updateProfileDraft({ voice:'' })}>删除声音</Button> : <Button kind="primary" className="full" onClick={() => updateProfileDraft({ voice:'0:16' })}>添加 16 秒声音</Button>}</>;
      if (sectionId === 'moments') return <><p className="muted">选填。没有内容时，公开 Profile 直接隐藏此模块。</p>{data.moments.map((moment,index) => <section className="moment-editor" key={`${moment.copy}-${index}`}><ProfilePhoto photo={moment.photo}/><FormInput label="这一刻" value={moment.copy} onChange={(copy) => setList('moments', data.moments.map((item,position) => position === index ? { ...item, copy } : item))}/><button onClick={() => setList('moments', data.moments.filter((_,position) => position !== index))}>×</button></section>)}{data.moments.length < 3 && <Button onClick={() => setList('moments', [...data.moments, { photo:'moment-shop', copy:'写下一个想被看见的瞬间。' }])}>＋ 添加一个瞬间</Button>}</>;
      return null;
    };
    return <Layout title={title} back bare><section className="profile-editor form"><p className="eyebrow">EDIT PROFILE</p><h2>{title}</h2>{content()}</section></Layout>;
  }

  function ProfileHistory() {
    const [tab, setTab] = useState('joined');
    const completed = dates.filter((date) => ['已结束','已取消'].includes(date.status));
    const list = completed.filter((date) => tab === 'joined' ? date.attendees.includes(me) : date.host === me);
    return <Layout title="个人历史" back bare><section className="profile-history-page"><div className="history-tabs"><button className={tab === 'joined' ? 'active' : ''} onClick={() => setTab('joined')}>我参与的</button><button className={tab === 'hosted' ? 'active' : ''} onClick={() => setTab('hosted')}>我发起的</button></div>{list.length ? <div className="history-list">{list.map((date) => <button key={date.id} onClick={() => go('detail', { dateId:date.id })}><span>{date.cover === 'vinyl' ? '◉' : date.cover === 'books' ? '▤' : '✦'}</span><div><b>{date.title}</b><small>{date.time} · {date.location}</small><small>{date.mode === 'one' ? '2 人' : `${date.capacity} 人`} · {date.status}</small></div><i>›</i></button>)}</div> : <Empty title="还没有活动记录" copy="去完成你的第一场 Dive。" action="去看活动" onClick={() => go('discover')}/>}</section></Layout>;
  }

  function ToggleSetting({ label, checked, onClick, copy }) { return <button className="settings-toggle" onClick={onClick}><span><b>{label}</b>{copy && <small>{copy}</small>}</span><i className={checked ? 'on' : ''}>{checked ? 'ON' : 'OFF'}</i></button>; }

  function PrivacySettings() {
    const privacy = activeProfile.privacy;
    return <Layout title="隐私设置" back bare><section className="settings-page"><p className="settings-kicker">Profile 可见范围</p><section className="visibility-choice"><button className={privacy.visibility === 'all' ? 'selected' : ''} onClick={() => updateProfileSetting('privacy', 'visibility', 'all')}><i>●</i><span><b>所有 Dive 用户</b><small>在符合活动关系的场景中可被查看。</small></span></button><button className={privacy.visibility === 'connected' ? 'selected' : ''} onClick={() => updateProfileSetting('privacy', 'visibility', 'connected')}><i>○</i><span><b>仅与我有活动关系的人</b><small>已确认活动关系后才可查看。</small></span></button></section><section className="settings-group"><ToggleSetting label="展示我的工作" checked={privacy.work} onClick={() => updateProfileSetting('privacy', 'work', !privacy.work)}/><ToggleSetting label="展示我的收入" checked={privacy.income} onClick={() => updateProfileSetting('privacy', 'income', !privacy.income)}/><ToggleSetting label="展示我的活动统计" checked={privacy.stats} onClick={() => updateProfileSetting('privacy', 'stats', !privacy.stats)}/><ToggleSetting label="展示我的活动历史" checked={privacy.history} onClick={() => updateProfileSetting('privacy', 'history', !privacy.history)}/></section><p className="settings-note">头像、昵称、年龄和现居城市始终公开；不会展示手机号、完整生日或精确地址。</p></section></Layout>;
  }

  function NotificationSettings() {
    const settings = activeProfile.notificationSettings;
    const rows = [['message','新消息通知'], ['hostReply','Host 回复通知'], ['application','申请状态通知'], ['confirmation','活动确认通知'], ['reminder','活动开始提醒'], ['change','活动修改通知'], ['feedback','活动评价提醒']];
    return <Layout title="通知设置" back bare><section className="settings-page"><p className="settings-kicker">所有通知默认开启</p><section className="settings-group">{rows.map(([key,label]) => <ToggleSetting key={key} label={label} checked={settings[key]} onClick={() => updateProfileSetting('notificationSettings', key, !settings[key])}/>)}</section><p className="settings-note">关闭后不再发送对应 Push；App 内的活动状态和红点仍会正常更新。</p></section></Layout>;
  }

  function DiscardProfileSheet() { return <Sheet close={() => setDiscardProfileEdit(false)}><section className="discard-sheet"><p className="eyebrow">UNSAVED CHANGES</p><h2>放弃这次修改？</h2><p className="muted">你刚刚编辑的 Profile 内容还没有保存。</p><div className="sheet-actions"><Button onClick={() => setDiscardProfileEdit(false)}>继续编辑</Button><Button kind="danger" onClick={() => { setDiscardProfileEdit(false); setProfileDraft(null); goBack(); }}>放弃修改</Button></div></section></Sheet>; }
  function NotificationSheet(){ return <Sheet close={()=>setNotificationOpen(false)}><h2>通知</h2><p className="muted">支付、安全、临近活动和重要变更会保留必要提醒。</p>{notifications.map((note,index)=><button className="note" key={index} onClick={()=>{ setNotifications(notifications.map((item,i)=>i===index?{...item,unread:false}:item)); setNotificationOpen(false); go('detail',{dateId:note.dateId}); }}><i className={note.unread?'unread':''}/><span><b>{note.title}</b><small>{note.body}</small></span></button>)}</Sheet>; }
  function Sheet({ children, close }) { return <div className="backdrop"><section className="sheet"><button className="close" onClick={close} aria-label="关闭">×</button>{children}</section></div>; }
  function Empty({ title,copy,action,onClick }) { return <div className="empty"><span>✦</span><h2>{title}</h2><p>{copy}</p><Button kind="primary" onClick={onClick}>{action}</Button></div>; }

  function CreateFlowStepper({ step }) { return <div className="create-flow-stepper">{['形式','灵感','补全','规则','Plan','预览','发布'].map((label,index) => <span className={index + 1 <= step ? 'active' : ''} key={label}><i>{index + 1}</i><small>{label}</small></span>)}</div>; }
  function CreateV3() {
    const d = createDraft;
    const [voiceText, setVoiceText] = useState(d.content);
    const [customVibe, setCustomVibe] = useState('');
    const [planRevisionOpen, setPlanRevisionOpen] = useState(false);
    const [revisionNote, setRevisionNote] = useState('');
    const [coverGeneration, setCoverGeneration] = useState({ loading:false, error:'' });
    const update = (patch) => { setCreateDraft((draft) => ({ ...draft, ...patch })); setCreateDirty(true); };
    const resetAiCreate = () => setAiCreate({ sessionId:null, revision:1, reply:'', quickReplies:[], missing:[], messages:[], input:'', loading:false, error:'' });
    const chooseMode = (mode) => { createVoiceRequest.current += 1; clearTimeout(createVoiceTimer.current); createSpeechRecognition.current?.stop?.(); setCreateVoice({ status:'idle' }); update({ mode, capacity:mode === 'one' ? 2 : 3, coverImage:'', coverPrompt:'' }); resetAiCreate(); };
    const toggleCreateListening = () => {
      if (createVoice.status === 'listening') {
        createVoiceRequest.current += 1;
        clearTimeout(createVoiceTimer.current);
        createSpeechRecognition.current?.stop?.();
        setCreateVoice({ status:'cancelled' });
        say('已取消本次录音');
        return;
      }
      const requestId = ++createVoiceRequest.current;
      clearTimeout(createVoiceTimer.current);
      createSpeechRecognition.current?.stop?.();
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setCreateVoice({ status:'failed' });
        say('当前浏览器不支持语音识别，请使用 Chrome 或直接输入文字');
        return;
      }
      setCreateVoice({ status:'listening' });
      try {
        const recognition = new SpeechRecognition();
        createSpeechRecognition.current = recognition;
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = true;
        let finalText = '';
        recognition.onresult = (event) => {
          let interimText = '';
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const text = event.results[index][0]?.transcript || '';
            if (event.results[index].isFinal) finalText += text;
            else interimText += text;
          }
          const recognized = (finalText || interimText).trim();
          if (!recognized || createVoiceRequest.current !== requestId) return;
          setVoiceText(recognized);
        };
        recognition.onerror = () => {
          if (createVoiceRequest.current !== requestId) return;
          setCreateVoice({ status:'failed' });
          say('识别失败，请直接输入文字');
        };
        recognition.onend = () => {
          if (createVoiceRequest.current !== requestId) return;
          const recognized = finalText.trim();
          if (!recognized) {
            setCreateVoice({ status:'failed' });
            say('没有识别到内容，请再试一次或直接输入文字');
            return;
          }
          setCreateDraft((draft) => ({ ...draft, content:appendRecognizedText(draft.content, recognized) }));
          setCreateDirty(true);
          setVoiceText('');
          setCreateVoice({ status:'completed' });
          say('已识别语音输入');
        };
        recognition.start();
      } catch {
        setCreateVoice({ status:'failed' });
        say('识别失败，请直接输入文字');
      }
    };
    const sendAiTurn = async (transcript, advance = false) => {
      const text = transcript.trim();
      if (!text || aiCreate.loading) return;
      if (!isSupabaseConfigured) {
        setAiCreate((state) => ({ ...state, error:'尚未配置 Supabase 项目地址与前端 Publishable Key，当前使用手动编辑模式。' }));
        if (advance) setCreateStep(3);
        return;
      }
      if (!backendUserId) {
        setAiCreate((state) => ({ ...state, error:'需要先建立登录会话，才能调用 AI 创建服务。' }));
        if (advance) setCreateStep(3);
        return;
      }
      setAiCreate((state) => ({ ...state, loading:true, error:'' }));
      try {
        const result = await continueDateCreation({ sessionId:aiCreate.sessionId, mode:d.mode, transcript:text, inputRevision:aiCreate.revision });
        update(aiSlotsToDraft(result.slot_updates));
        setAiCreate((state) => ({
          ...state,
          sessionId:result.session_id,
          revision:result.input_revision,
          reply:result.reply,
          quickReplies:result.quick_replies || [],
          missing:result.missing_fields_remaining || [],
          input:'',
          loading:false,
          error:'',
          messages:[...state.messages, { role:'user', text }, { role:'assistant', text:result.reply }]
        }));
        if (advance) setCreateStep(3);
      } catch (error) {
        console.error('AI creation failed', error);
        setAiCreate((state) => ({ ...state, loading:false, error:error.message || 'AI 暂时不可用，可以继续手动填写。' }));
        if (advance) setCreateStep(3);
      }
    };
    const toggleVibe = (vibe) => update({ vibe: d.vibe.includes(vibe) ? d.vibe.filter((item) => item !== vibe) : d.vibe.length < 3 ? [...d.vibe, vibe] : d.vibe });
    const addCustomVibe = () => { const next = customVibe.trim(); if (!next) return; if (d.vibe.includes(next)) return setCustomVibe(''); if (d.vibe.length >= 3) return say('活动氛围最多选择 3 个'); update({ vibe:[...d.vibe, next] }); setCustomVibe(''); };
    const coreValid = d.time.trim() && d.location.trim() && Number(d.budget) >= 0 && d.payment && d.expectation.trim() && d.vibe.length && (!d.lockFeeEnabled || Number(d.fee) > 0);
    const ensureCoverImage = async () => {
      const fallback = d.mode === 'one' ? '/date-plan-assets/date-plan-one.png' : '/date-plan-assets/date-plan-small.png';
      if (!isSupabaseConfigured || !backendUserId) {
        update({ coverImage:d.coverImage || fallback, coverPrompt:d.coverPrompt || `${d.title} · ${d.content} · ${d.vibe.join('、')}` });
        return true;
      }
      setCoverGeneration({ loading:true, error:'' });
      try {
        const cover = await generateDateCover({ mode:d.mode, title:d.title, content:d.content, vibe:d.vibe, location:d.location, capacity:d.capacity });
        update({ coverImage:cover.cover_image_url, coverPrompt:cover.cover_prompt });
        setCoverGeneration({ loading:false, error:'' });
        say(cover.mock ? '已生成封面占位图' : 'AI 封面图已生成');
        return true;
      } catch (error) {
        console.error('Date cover generation failed', error);
        update({ coverImage:d.coverImage || fallback, coverPrompt:d.coverPrompt || `${d.title} · ${d.content} · ${d.vibe.join('、')}` });
        setCoverGeneration({ loading:false, error:error.message || 'AI 封面图生成失败，已使用本地封面' });
        say('AI 封面图生成失败，已使用本地封面');
        return false;
      }
    };
    const generatePlan = async () => {
      if (!coreValid) {
        say(d.lockFeeEnabled && !Number(d.fee) ? '开启 Lock fee 后，请填写金额' : '请补齐时间、区域、预算、付费方式和参与者期待');
        return;
      }
      await ensureCoverImage();
      setCreateStep(5);
    };
    const backFromCreate = () => { if (createDirty) setCreateExitPrompt(true); else goBack(); };
    const publish = async () => {
      let next = { id:`d${Date.now()}`, host:me, mode:d.mode, title:d.title, cover:'custom', coverImage:d.coverImage, coverPrompt:d.coverPrompt, vibe:d.vibe, content:d.content, description:d.description, time:d.time, timeFlexible:d.timeFlexible, location:d.location, locationFlexible:d.locationFlexible, exact:d.exact || 'Host 将在 Lock 后开放精确集合点', budget:Number(d.budget), budgetScope:d.budgetScope, payment:d.payment, lockFee:d.lockFeeEnabled ? Number(d.fee) : 0, lockFeeEnabled:d.lockFeeEnabled, refund:d.refundPolicy, expectation:d.expectation, capacity:d.capacity, attendees:[], status:'招募中', rhythm:d.groupRhythm, icebreaker:d.icebreaker, selectionRule:d.selectionRule, groupChatRule:d.groupChatRule, confirmationTiming:d.confirmationTiming, exitPolicy:d.exitPolicy, visibility:d.visibility };
      if (isSupabaseConfigured) {
        if (!backendUserId) return say('请先登录后再发布 Date');
        try {
          const remote = await createDate(backendUserId, d);
          next = { ...next, ...remote, host:me, hostUserId:backendUserId };
        } catch (error) {
          console.error('Date publish failed', error);
          say('Date 发布失败，请检查网络后重试');
          return;
        }
      }
      setDates((items) => [next, ...items]);
      createVoiceRequest.current += 1; clearTimeout(createVoiceTimer.current); setCreateVoice({ status:'idle' });
      setPublishConfirm(false); setCreateDirty(false); setCreateDraft(makeCreateDraft()); setCreateStep(1); setMyTab('hosted'); resetAiCreate();
      say('Date 已发布，等待你手动审核 Apply'); go('publish-success', { dateId:next.id });
    };
    const planModeCopy = d.mode === 'one' ? '为两个人留出真实、不过度用力的相处时间。' : `为 Host 和 ${d.capacity - 1} 位 Guest 留出自然认识彼此的空间。`;
    return <Layout title="创建 Date" back bare onBack={backFromCreate}><CreateFlowStepper step={publishConfirm ? 7 : createStep}/>
      {createStep === 1 && <section className="card form glass-strong create-stage"><p className="eyebrow">A0 · 选择见面方式</p><h2>你想怎么认识？</h2><p className="muted">先决定是一场专注的 1v1，还是一场有边界的小型多人 Date。</p><div className="mode-buttons create-mode-cards"><button className={d.mode === 'one' ? 'selected' : ''} onClick={() => chooseMode('one')}><b>一对一约会</b><span>1v1 Date</span><small>更专注地认识一个人；Host 就是约会对象。</small></button><button className={d.mode === 'small' ? 'selected' : ''} onClick={() => chooseMode('small')}><b>小型多人约会</b><span>Small Date</span><small>Host 与 2–4 位 Guest 在具体场景里自然认识。</small></button></div><Button kind="primary" className="full" onClick={() => setCreateStep(2)}>继续</Button></section>}
      {createStep === 2 && <section className="card form glass-strong create-stage"><p className="eyebrow">{d.mode === 'one' ? 'C1' : 'M1'} · 灵感输入</p><h2>{d.mode === 'one' ? '这次，想怎么认识一个人？' : '你想和怎样的一群人认识？'}</h2>{d.mode === 'small' && <ChoiceGroup label="总人数（含 Host）" values={[3,4,5]} selected={[d.capacity]} onClick={(capacity) => update({ capacity:Number(capacity) })}/>}<section className="voice-input-card glass-strong"><button className={`voice-mic ${createVoice.status === 'listening' ? 'listening' : ''}`} onClick={toggleCreateListening} aria-label={createVoice.status === 'listening' ? '取消录音' : '开始录音'}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></button><b>{createVoice.status === 'listening' ? '正在听，再次点击取消' : createVoice.status === 'completed' ? '识别完成，可继续补充' : createVoice.status === 'cancelled' ? '已取消，可重新开始' : createVoice.status === 'failed' ? '识别失败，请使用文字输入' : '点击说话'}</b></section><label>或直接输入<textarea value={d.content} placeholder={d.mode === 'one' ? '例如：周六下午去逛书店，预算 150，想轻松认识一个喜欢摄影的人。' : '例如：想组织 4 个人周日下午做陶艺，希望轻松认识新朋友。'} onChange={(event) => update({ content:event.target.value })}/></label><div className="sheet-actions"><Button onClick={() => setCreateStep(1)}>返回</Button><Button kind="primary" disabled={aiCreate.loading} onClick={() => d.content.trim() ? sendAiTurn(d.content, true) : say('先说说想一起做什么')}>{aiCreate.loading ? 'AI 正在理解…' : '让 AI 继续追问'}</Button></div></section>}
      {createStep === 3 && <section className="card form glass-strong create-stage"><p className="eyebrow">{d.mode === 'one' ? 'C2' : 'M2'} · AI 信息补全</p><h2>{aiCreate.reply ? '继续把这场 Date 聊清楚' : '我先理解了这些'}</h2>{aiCreate.error && <section className="ai-create-error"><b>当前使用手动编辑</b><p>{aiCreate.error}</p></section>}{aiCreate.messages.length > 0 && <section className="ai-create-chat" aria-live="polite">{aiCreate.messages.map((message, index) => <div className={`ai-create-turn ${message.role}`} key={`${message.role}-${index}`}><small>{message.role === 'assistant' ? 'Dive AI' : '你'}</small><p>{message.text}</p></div>)}{aiCreate.loading && <div className="ai-create-turn assistant loading"><small>Dive AI</small><p>正在整理你刚刚补充的信息…</p></div>}</section>}{aiCreate.missing.length > 0 && <section className="ai-missing-fields"><b>还需要确认</b><div>{aiCreate.missing.map((field) => <span key={field}>{aiFieldLabels[field] || field}</span>)}</div></section>}{aiCreate.quickReplies.length > 0 && <div className="ai-quick-replies">{aiCreate.quickReplies.map((reply) => <button key={reply} disabled={aiCreate.loading} onClick={() => sendAiTurn(reply)}>{reply}</button>)}</div>}{aiCreate.reply && <section className="ai-create-composer"><textarea value={aiCreate.input} placeholder="直接回答上面的问题，也可以说“这项待定”" onChange={(event) => setAiCreate((state) => ({ ...state, input:event.target.value }))}/><Button kind="primary" disabled={aiCreate.loading || !aiCreate.input.trim()} onClick={() => sendAiTurn(aiCreate.input)}>发送</Button></section>}{!aiCreate.reply && d.content.trim().length > 3 && <><section className="keyword-chips"><b>本地提取到的关键词</b><div>{extractKeywords(d.content).length ? extractKeywords(d.content).map((word) => <span key={word}>{word}</span>) : <span>暂未提取到关键词</span>}</div></section><section className="ai-recommendations"><b>本地灵感建议</b>{generateRecommendations(d.content, d.mode, d.capacity).map((rec, index) => <button className="rec-card" key={index} onClick={() => { update({ title:rec.title, content:rec.content, vibe:rec.vibe, budget:rec.budget, location:rec.location }); say(`已采用：${rec.title}`); }}><b>{rec.title}</b><p>{rec.content}</p><div className="rec-tags">{rec.vibe.map((v) => <span key={v}>{v}</span>)}</div><div className="rec-meta"><span>约 ¥{rec.budget}</span><span>{rec.location}</span></div></button>)}</section></>}<section className="field-state known"><span>✓ 已记录</span><b>活动内容</b><p>{d.content}</p></section><section className="field-state inferred"><span>✦ 模型建议，等你确认</span><b>标题、氛围与对外介绍</b><p>模型只补全草稿；最终内容和发布动作始终由你确认。</p></section><FormInput label="活动标题" value={d.title} onChange={(title) => update({ title })}/><ChoiceGroup label="活动氛围（至少 1 个，最多 3 个）" values={['松弛','有点好奇','温柔','一起动手','城市漫游','不赶时间']} selected={d.vibe} multi onClick={toggleVibe}/><div className="custom-vibe"><input value={customVibe} onChange={(event) => setCustomVibe(event.target.value)} placeholder="自定义氛围，例如：一点浪漫"/><button onClick={addCustomVibe}>添加</button></div><FormInput label="活动描述（对外可见）" area value={d.description} onChange={(description) => update({ description })}/><div className="sheet-actions"><Button onClick={() => setCreateStep(2)}>返回</Button><Button kind="primary" onClick={() => d.title.trim() && d.vibe.length && d.description.trim() ? setCreateStep(4) : say('请补齐标题、至少一个氛围和活动描述')}>确认这些信息</Button></div></section>}
      {createStep === 4 && <section className="card form glass-strong create-stage"><p className="eyebrow">{d.mode === 'one' ? 'C2 · 行程与费用' : 'M2 / M3 · 行程与参与规则'}</p><h2>把这场 Date 讲清楚</h2><FormInput label="活动时间" value={d.time} onChange={(time) => update({ time })}/><label className="check"><input type="checkbox" checked={d.timeFlexible} onChange={(event) => update({ timeFlexible:event.target.checked })}/>允许模糊时间表达，例如「下周晚上」</label><FormInput label="公开区域" value={d.location} onChange={(location) => update({ location })}/><label className="check"><input type="checkbox" checked={d.locationFlexible} onChange={(event) => update({ locationFlexible:event.target.checked })}/>允许模糊地点表达，例如「静安寺附近」</label><FormInput label="精确集合点（仅 Lock 后可见）" value={d.exact} onChange={(exact) => update({ exact })}/><div className="two-choice"><ChoiceGroup label="预算口径" values={['人均','总预算']} selected={[d.budgetScope]} onClick={(budgetScope) => update({ budgetScope })}/><FormInput label={`预算（${d.budgetScope}）`} type="number" value={d.budget} onChange={(budget) => update({ budget:Number(budget) })}/></div><ChoiceGroup label="付费方式" values={['AA','Host 请客','各自支付']} selected={[d.payment]} onClick={(payment) => update({ payment })}/><section className="fee-choice"><div><b>设置 Lock fee</b><small>仅在你同意 Apply 后，由 Guest 主动支付锁定席位。</small></div><button className={d.lockFeeEnabled ? 'selected' : ''} onClick={() => update({ lockFeeEnabled:!d.lockFeeEnabled })}>{d.lockFeeEnabled ? '已开启' : '未开启'}</button></section>{d.lockFeeEnabled && <FormInput label="Lock fee 金额" type="number" value={d.fee} onChange={(fee) => update({ fee:Number(fee) })}/>}<label>退款 / 取消规则<textarea value={d.refundPolicy} onChange={(event) => update({ refundPolicy:event.target.value })}/></label><FormInput label="对参与者的期待" area value={d.expectation} onChange={(expectation) => update({ expectation })}/>{d.mode === 'small' && <section className="small-date-rules"><h3>Small Date 参与规则</h3><ChoiceGroup label="Guest 选择规则" values={['Host 审核','先到先得','混合']} selected={[d.selectionRule]} onClick={(selectionRule) => update({ selectionRule })}/><ChoiceGroup label="群体交流方式" values={['轻松聊天','有主题流程','安静共处']} selected={[d.groupRhythm]} onClick={(groupRhythm) => update({ groupRhythm })}/><ChoiceGroup label="破冰方式" values={['不需要','轻量即可','需要明确破冰']} selected={[d.icebreaker]} onClick={(icebreaker) => update({ icebreaker })}/><ChoiceGroup label="群聊开放条件" values={['全部 Lock 后自动建群','Host 手动建群','暂不创建群聊']} selected={[d.groupChatRule]} onClick={(groupChatRule) => update({ groupChatRule })}/><FormInput label="预计确认时间" value={d.confirmationTiming} onChange={(confirmationTiming) => update({ confirmationTiming })}/><FormInput label="中途离开说明" area value={d.exitPolicy} onChange={(exitPolicy) => update({ exitPolicy })}/></section>}<ChoiceGroup label="可见范围" values={['公开','仅好友可见']} selected={[d.visibility]} onClick={(visibility) => update({ visibility })}/>{coverGeneration.error && <section className="ai-create-error"><b>封面图生成提示</b><p>{coverGeneration.error}</p></section>}<div className="sheet-actions"><Button onClick={() => setCreateStep(3)}>返回</Button><Button kind="primary" disabled={coverGeneration.loading} onClick={generatePlan}>{coverGeneration.loading ? '正在生成封面图…' : '生成 Date Plan'}</Button></div></section>}
      {createStep === 5 && <section className="card form glass-strong create-stage"><p className="eyebrow">{d.mode === 'one' ? 'C3' : 'M4'} · AI Date Plan</p><h2>这是我为你整理的 Date Plan</h2><section className={`date-plan-art ${d.mode} generated-cover`}>{d.coverImage ? <img src={d.coverImage} alt=""/> : <span>{d.mode === 'one' ? '◌' : '◌ ◌ ◌'}</span>}<b>{d.mode === 'one' ? '两个人走进一场具体的见面' : `${d.capacity} 个人在具体场景里慢慢认识`}</b><small>{coverGeneration.loading ? '场景封面正在生成。' : d.coverImage ? '场景封面已根据活动内容、氛围与人数生成。' : '场景封面会根据活动内容、氛围与人数生成。'}</small></section>{coverGeneration.error && <section className="ai-create-error"><b>封面图生成提示</b><p>{coverGeneration.error}</p></section>}<div className="plan create-plan"><span>✦</span><h2>{d.title}</h2><p>{d.content}</p></div><div className="plan-privacy"><span>公开给申请人：{d.title}、{d.location}、预算、期待与 Host 公开资料</span><span>Lock 后开放：精确集合点、完整行程和{d.mode === 'small' ? '活动群聊' : '一对一活动 IM'}</span></div><div className="timeline"><p><b>{d.time}{d.timeFlexible ? ' · 时间可协调' : ''}</b><br/><span>在 {d.location} 附近集合</span></p><p><b>{d.content}</b><br/><span>{d.budgetScope}约 ¥{d.budget} · {d.payment} · {d.lockFeeEnabled ? `Lock fee ¥${d.fee}` : '未设置 Lock fee'}</span></p><p><b>自然结束</b><br/><span>{d.exitPolicy}</span></p></div>{d.mode === 'small' && <section className="plan-group-summary"><b>Small Date · {d.capacity} 人</b><span>{d.groupRhythm} · {d.icebreaker} · {d.selectionRule}</span><span>{d.groupChatRule}</span></section>}<section className="plan-reasons"><b>为什么这样安排</b><p>• {planModeCopy}</p><p>• 「{d.location}」先以区域公开，既方便判断，也不提前暴露精确集合点。</p><p>• {d.lockFeeEnabled ? `Lock fee ¥${d.fee} 只在你确认 Guest 后产生，避免无意占位。` : '没有设置 Lock fee，申请通过后直接确认席位。'}</p></section><div className="plan-chips"><button onClick={() => update({ vibe:['松弛','温柔'] })}>更轻松一点</button><button onClick={() => update({ budget:Math.max(0,Number(d.budget) - 20) })}>预算降低</button><button onClick={() => update({ location:'附近室内空间' })}>换成室内</button><button disabled={coverGeneration.loading} onClick={ensureCoverImage}>{coverGeneration.loading ? '生成中' : '重新生成封面'}</button></div><div className="sheet-actions"><Button onClick={() => setPlanRevisionOpen(true)}>还不是我想要的</Button><Button kind="primary" onClick={() => setCreateStep(6)}>确认这份 Date 方案</Button></div></section>}
      {createStep === 6 && <section className="card form publish-preview create-stage"><p className="eyebrow">{d.mode === 'one' ? 'C4' : 'M5'} · Host 发布预览</p><h2>这就是 Guest 将看到的 Date</h2><Hero date={{ ...d, host:me, cover:'custom', attendees:[], status:'招募中', lockFee:d.lockFeeEnabled ? d.fee : 0, refund:d.refundPolicy }} compact/><section className="host-preview-grid"><div><small>Guest 可见的 Host Profile</small>{d.hostProfileFields.map((field) => <span key={field}>✓ {field}</span>)}</div><div><small>申请后的规则</small><span>✓ 你手动审核 Apply</span><span>✓ {d.lockFeeEnabled ? `同意后支付 ¥${d.fee} Lock fee` : '同意后直接确认席位'}</span>{d.mode === 'small' && <span>✓ {d.groupChatRule}</span>}</div></section><section className="publish-checks"><p>✓ 公开范围：{d.visibility}；精确集合点只在 Lock 后开放</p><p>✓ 退款规则：{d.refundPolicy || '将在发布前补充'}</p><p>✓ 重要修改将通知已申请 / 已确认用户，不能静默覆盖关键行程信息</p></section><div className="sheet-actions"><Button onClick={() => setCreateStep(5)}>返回修改</Button><Button kind="primary" onClick={() => setPublishConfirm(true)}>发布这场 Date</Button></div></section>}
      {planRevisionOpen && <Sheet close={() => setPlanRevisionOpen(false)}><section className="plan-revision-sheet form"><p className="eyebrow">PLAN REVISION</p><h2>你想调整哪一部分？</h2><p className="muted">AI 只会改动你指出的维度，其他已确认字段会被保留。</p><label>告诉我你的想法<textarea value={revisionNote} placeholder="例如：想把节奏再放慢一点，活动结束得早一些。" onChange={(event) => setRevisionNote(event.target.value)}/></label><div className="sheet-actions"><Button onClick={() => setPlanRevisionOpen(false)}>取消</Button><Button kind="primary" onClick={() => { if (!revisionNote.trim()) return say('先写下想调整的地方'); update({ description:`${d.description}（已按你的意见调整：${revisionNote.trim()}）` }); setRevisionNote(''); setPlanRevisionOpen(false); say('Date Plan 已按你的意见重新生成'); }}>重新生成方案</Button></div></section></Sheet>}
      {publishConfirm && <Sheet close={() => { setPublishConfirm(false); setCreateStep(6); }}><section className="publish-confirm-sheet"><p className="eyebrow">C5 · 最后确认</p><h2>发布这场 Date？</h2><section className="confirm-date-summary"><span>{d.mode === 'one' ? '◌' : '◌ ◌ ◌'}</span><div><b>{d.title}</b><small>{modeName[d.mode]} · {d.time} · {d.location}</small><small>{d.budgetScope} ¥{d.budget} · {d.lockFeeEnabled ? `Lock fee ¥${d.fee}` : '未设置 Lock fee'}</small></div></section><p>发布后将{d.visibility === '公开' ? '进入活动广场' : '仅对好友可见'}。你仍需手动确认每一份 Apply；精确集合点只在 Guest Lock 后开放。</p><div className="sheet-actions"><Button onClick={() => { setPublishConfirm(false); setCreateStep(6); }}>继续编辑</Button><Button kind="primary" onClick={publish}>确认发布</Button></div></section></Sheet>}
      {createExitPrompt && <Sheet close={() => setCreateExitPrompt(false)}><section className="discard-sheet"><p className="eyebrow">CREATE DRAFT</p><h2>要离开这场 Date 吗？</h2><p className="muted">可以保留当前草稿，下次从这里继续；或者放弃本次内容。</p><div className="sheet-actions"><Button onClick={() => setCreateExitPrompt(false)}>继续编辑</Button><Button onClick={() => { setCreateExitPrompt(false); say('草稿已保留'); goBack(); }}>保留草稿并离开</Button><Button kind="danger" onClick={() => { createVoiceRequest.current += 1; clearTimeout(createVoiceTimer.current); setCreateVoice({ status:'idle' }); setCreateExitPrompt(false); setCreateDraft(makeCreateDraft()); setCreateDirty(false); setCreateStep(1); resetAiCreate(); goBack(); }}>放弃草稿</Button></div></section></Sheet>}
    </Layout>;
  }
  function PublishSuccess({ date }) { return <Layout title="发布完成" back bare><section className="publish-success"><div className="success-mark">✓</div><p className="eyebrow">DATE IS LIVE</p><h1>这场 Date 已发布</h1><p>它已{date.visibility === '公开' ? '进入活动广场' : '设为仅好友可见'}。接下来由你决定是否接受每一份 Apply。</p><section className="success-date-card"><span>{date.mode === 'one' ? '◌' : '◌ ◌ ◌'}</span><b>{date.title}</b><small>{date.time} · {date.location}</small><small>{modeName[date.mode]} · {date.lockFee ? `Lock fee ¥${date.lockFee}` : '未设置 Lock fee'}</small></section><div className="action-stack"><Button kind="primary" onClick={() => go('detail',{ dateId:date.id })}>查看 Host 管理</Button><Button onClick={() => { setMyTab('hosted'); go('my'); }}>回到我发起的活动</Button><Button onClick={() => go('discover')}>去活动广场看看</Button></div></section></Layout>; }

  if (screen.name === 'splash') return <Splash/>;
  if (screen.name === 'dating-plan') return <DatingPlan/>;
  if (screen.name === 'voice-preference') return <VoicePreference/>;
  if (screen.name === 'discover') return <Discover/>;
  if (screen.name === 'detail') return <Detail date={currentDate(screen.dateId)}/>;
  if (screen.name === 'my') return <MyActivities/>;
  if (screen.name === 'activity-controls') return <ActivityControls/>;
  if (screen.name === 'create') return <CreateV3/>;
  if (screen.name === 'publish-success') return <PublishSuccess date={currentDate(screen.dateId)}/>;
  if (screen.name === 'edit') return <Edit date={currentDate(screen.dateId)}/>;
  if (screen.name === 'invite') return <Invite date={currentDate(screen.dateId)}/>;
  if (screen.name === 'im') return <IM/>;
  if (screen.name === 'im-search') return <IMSearch/>;
  if (screen.name === 'chat') return <Chat chat={chats.find((chat)=>chat.id===screen.chatId)}/>;
  if (screen.name === 'activity-picker') return <ActivityPicker chatId={screen.chatId}/>;
  if (screen.name === 'profile') return screen.userId ? <PublicProfile userId={screen.userId}/> : <ProfileHome/>;
  if (screen.name === 'public-profile') return <PublicProfile userId={screen.userId || me}/>;
  if (screen.name === 'edit-profile') return <EditProfile/>;
  if (screen.name === 'profile-editor') return <ProfileEditor sectionId={screen.sectionId}/>;
  if (screen.name === 'profile-history') return <ProfileHistory/>;
  if (screen.name === 'privacy') return <PrivacySettings/>;
  if (screen.name === 'notification-settings') return <NotificationSettings/>;
  if (screen.name === 'onboarding') return <Onboarding/>;
  if (screen.name === 'feedback') return <Feedback/>;
  return <Discover/>;
}

export default App;

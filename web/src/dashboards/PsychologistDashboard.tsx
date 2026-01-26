import { useEffect, useMemo, useRef, useState } from 'react';
import avatarIcon from '../assets/psychologist.png';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

/* ================= TYPES ================= */

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM';

type SensitiveWordRow = {
  id: string;
  user_id: string;
  detected_word: string;
  confidence: number | null;
  source: 'text' | 'audio' | 'system';

  message_id: string | null;
  message_table: 'messages' | 'community_messages' | 'private_messages' | null;
  conversation_id: string | null;

  created_at: string;
};

type PrivateSession = {
  id: string;
  case_id: string;
  psychologist_id: string;
  teen_id: string;

  topic: string;
  scheduled_at: string;
  meeting_link: string;

  status: 'scheduled' | 'completed' | 'cancelled';
  payment_status: 'paid' | 'unpaid';
  price_cents: number;

  psychologist_notes: string | null;
  created_at: string;
};
type TeenUser = {
  id: string;
  name: string;
};
type CaseRow = {
  id: string;
  psychologist_id: string;
  teen_id: string;
  sensitive_word_id: string;
  emergency_case_id: string;
  detected_word: string;
  risk_level: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'open' | 'in_session' | 'closed';
  opened_at: string;

  // UI-only
  teen_name?: string;
};
type ChatMessage = {
  id: string;
  user_id: string;
  sender: 'user' | 'bot' | 'counselor';
  content: string;
  type: 'text' | 'voice';
  created_at: string;
};

type RiskItem = SensitiveWordRow & {
  teen_name: string; // fetched from public.users
  level: RiskLevel;
};
type PsychologistAlert = {
  id: string;
  sensitive_word_id: string;
  emergency_case_id: string;
  message: string;
  status: 'unread' | 'read';
  created_at: string;
};


/* ================= HELPERS ================= */

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const normalize = (s: string) => (s || '').trim().toLowerCase();

const getRiskLevel = (word: string, confidence: number | null): RiskLevel => {
  const w = normalize(word);

  // You can expand this list anytime
  const criticalWords = [
    'suicide',
    'kill myself',
    'self harm',
    'self-harm',
    'cut',
    'cutting',
    'overdose',
    'i want to die',
    'die',
    'hurt myself',
  ];

  const highWords = [
    'panic',
    'anxiety attack',
    'depressed',
    'depression',
    'abuse',
    'violence',
    'addiction',
    'drugs',
    'alcohol',
  ];

  if (criticalWords.some((k) => w.includes(k))) return 'CRITICAL';
  if (highWords.some((k) => w.includes(k))) return 'HIGH';

  // Confidence-based fallback
  if ((confidence ?? 0) >= 0.85) return 'HIGH';
  return 'MEDIUM';
};

/* ================= COMPONENT ================= */

function PsychologistDashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const [tab, setTab] = useState<'risk' | 'cases' | 'sessions' | 'messages' | 'progress'>('risk');

  // Risk Queue state
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState('');
  const [riskItems, setRiskItems] = useState<RiskItem[]>([]);

  // Selected risk → show chat
  const [selected, setSelected] = useState<RiskItem | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [isEditing, setIsEditing] = useState(true);
  const [chat, setChat] = useState<ChatMessage[]>([]);
 // Emergency cooldowns: user_id -> last clicked timestamp
const [emergencyCooldowns, setEmergencyCooldowns] = useState<Record<string, number>>({});

const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes (test)
// 2 minutes (test)
const [paidEmergencyMap, setPaidEmergencyMap] = useState<
  Map<string, string>
>(new Map());
const [cases, setCases] = useState<CaseRow[]>([]);

const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
const [upcomingSession, setUpcomingSession] = useState<PrivateSession | null>(null);
const [completedSessions, setCompletedSessions] = useState<PrivateSession[]>([]);
const sessionFormRef = useRef<HTMLDivElement | null>(null);

const [topic, setTopic] = useState('');
const [sessionDate, setSessionDate] = useState('');
const [sessionTime, setSessionTime] = useState('');
const [description, setDescription] = useState('');
const [zoomLink, setZoomLink] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState('');
const [progressModalOpen, setProgressModalOpen] = useState(false);
const [progressSession, setProgressSession] = useState<PrivateSession | null>(null);
const [progressBySession, setProgressBySession] = useState<
  Record<string, {
    plan_level: number;
    skills_level: number;
    goals_level: number;
    notes: string | null;
  }>
>({});

const [planLevel, setPlanLevel] = useState(0);
const [skillsLevel, setSkillsLevel] = useState(0);
const [goalsLevel, setGoalsLevel] = useState(0);
const [progressNotes, setProgressNotes] = useState('');
const [sessionsByCase, setSessionsByCase] = useState<
  Record<string, {
    upcoming: PrivateSession | null;
    completed: PrivateSession[];
  }>
>({});

const isValidZoomLink = (url: string) => {
  try {
    const parsed = new URL(url);

    // must be zoom.us domain
    if (!parsed.hostname.includes('zoom.us')) return false;

    // must include /j/{meetingId}
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const jIndex = pathParts.indexOf('j');

    if (jIndex === -1 || !pathParts[jIndex + 1]) return false;

    // meeting id must be numeric
    return /^\d+$/.test(pathParts[jIndex + 1]);
  } catch {
    return false;
  }
};
const canMarkSessionCompleted = (
  scheduledAt: string,
  status: string
) => {
  if (status !== 'scheduled') return false;

  const start = new Date(scheduledAt);

  // force local time (avoid timezone shift)
  const localStart = new Date(
    start.getTime() + start.getTimezoneOffset() * 60000
  );

  const twoHoursLater = new Date(
    localStart.getTime() + 2 * 60 * 60 * 1000
  );

  return new Date() >= twoHoursLater;
};
const saveSessionProgress = async () => {
  if (!progressSession) return;

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const existing = progressBySession[progressSession.id];

    const payload = {
      session_id: progressSession.id,
      teen_id: progressSession.teen_id,
      plan_level: planLevel,
      skills_level: skillsLevel,
      goals_level: goalsLevel,
      notes: progressNotes || null,
    };

    if (existing) {
      // ✏️ UPDATE
      const { error } = await supabase
        .from('session_progress')
        .update(payload)
        .eq('session_id', progressSession.id);

      if (error) throw error;

      setSuccess('Progress updated successfully ✏️');
    } else {
      // ➕ INSERT
      const { error } = await supabase
        .from('session_progress')
        .insert({
          ...payload,
          sessions_completed: 1,
        });

      if (error) throw error;

      setSuccess('Progress saved successfully ✅');
    }

    // 🔄 Update local cache so UI switches to "Edit"
    setProgressBySession(prev => ({
      ...prev,
      [progressSession.id]: payload,
    }));

    setProgressModalOpen(false);
  } catch (err) {
    console.error(err);
    setError('Failed to save progress');
  } finally {
    setLoading(false);
  }
};
const fetchSessionProgress = async () => {
  const { data, error } = await supabase
    .from('session_progress')
    .select(
      'session_id, plan_level, skills_level, goals_level, notes'
    );

  if (error || !data) return;

  const map: typeof progressBySession = {};
  data.forEach(p => {
    map[p.session_id] = {
      plan_level: p.plan_level,
      skills_level: p.skills_level,
      goals_level: p.goals_level,
      notes: p.notes,
    };
  });

  setProgressBySession(map);
};
const handleDeletePrivateSession = async () => {
  if (!upcomingSession) return;

  const confirmed = window.confirm(
    'Are you sure you want to delete this session?'
  );
  if (!confirmed) return;

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error();

    const { error } = await supabase
      .from('private_sessions')
      .delete()
      .eq('id', upcomingSession.id)
      .eq('psychologist_id', user.id); // 🔑 REQUIRED (same as counselor)

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess('Session deleted successfully 🗑️');

    setUpcomingSession(null);
    setIsEditing(true);
    setTopic('');
    setSessionDate('');
    setSessionTime('');
    setZoomLink('');
    setDescription('');
  } catch {
    setError('Failed to delete session');
  } finally {
    setLoading(false);
  }
};

const fetchSessionsForCase = async (caseId: string) => {
  setLoading(true);
  setError('');

  const { data, error } = await supabase
    .from('private_sessions')
    .select('*')
    .eq('case_id', caseId)
    .order('scheduled_at', { ascending: true });

  if (error) {
    setError(error.message);
    setLoading(false);
    return;
  }

  const scheduled =
    data?.find(s => s.status === 'scheduled') ?? null;

  const completed =
    data?.filter(s => s.status === 'completed') ?? [];

  setUpcomingSession(scheduled);
  setCompletedSessions(completed);

  if (scheduled) {
    const dt = new Date(scheduled.scheduled_at);
    setTopic(scheduled.topic);
    setSessionDate(dt.toISOString().slice(0, 10));
    setSessionTime(dt.toISOString().slice(11, 16));
    setZoomLink(scheduled.meeting_link ?? '');
    setDescription(scheduled.psychologist_notes ?? '');
    setIsEditing(false); // 🔒 LOCK FORM
  } else {
    // 🔓 no upcoming → unlock form
    setIsEditing(true);
    setTopic('');
    setSessionDate('');
    setSessionTime('');
    setZoomLink('');
    setDescription('');
  }

  setLoading(false);
  setSessionsByCase(prev => ({
  ...prev,
  [caseId]: {
    upcoming: scheduled,
    completed,
  },
}));
};
const fetchAllSessionsForCases = async () => {
  if (cases.length === 0) return;

  const { data, error } = await supabase
    .from('private_sessions')
    .select('*')
    .in(
      'case_id',
      cases.map(c => c.id)
    )
    .order('scheduled_at', { ascending: true });

  if (error || !data) return;

  const grouped: Record<
    string,
    { upcoming: PrivateSession | null; completed: PrivateSession[] }
  > = {};

  cases.forEach(c => {
    grouped[c.id] = { upcoming: null, completed: [] };
  });

  data.forEach(session => {
    if (!grouped[session.case_id]) return;

    if (session.status === 'scheduled') {
      grouped[session.case_id].upcoming = session;
    } else if (session.status === 'completed') {
      grouped[session.case_id].completed.push(session);
    }
  });

  setSessionsByCase(grouped);
};
const formatLocalDateTime = (iso: string) => {
  const d = new Date(iso);

  const local = new Date(
    d.getTime() + d.getTimezoneOffset() * 60000
  );

  return local.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
const handleMarkSessionDone = async () => {
  if (!upcomingSession) return;

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    const { error } = await supabase
      .from('private_sessions')
      .update({ status: 'completed' })
      .eq('id', upcomingSession.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess('Session marked as completed ✅');
    fetchSessionsForCase(selectedCaseId!);
  } catch {
    setError('Failed to mark session as completed');
  } finally {
    setLoading(false);
  }
};
const sendPaymentReminder = async (
  session: PrivateSession,
  caseRow: CaseRow
) => {
  try {
    const formattedDate = formatLocalDateTime(session.scheduled_at);

    const message = `Reminder: Your child (${caseRow.teen_name}) has a session scheduled on ${formattedDate}. Please complete payment to allow them to attend.`;

    const { error } = await supabase
      .from('parent_alerts')
      .insert({
        child_id: session.teen_id,
        detected_word: 'payment_reminder',
        risk_level: 'MEDIUM',
        message,
        status: 'unread',
        private_session_id: session.id,
      });

    if (error) {
      alert('Failed to send reminder');
      console.error(error);
      return;
    }

    alert('✅ Payment reminder sent to parent');
  } catch (err) {
    console.error(err);
    alert('Unexpected error sending reminder');
  }
};
const handleSaveSession = async () => {
 if (!isSessionFormValid || !selectedCaseId) {
  setError('Please complete all required fields correctly.');
  return;
}

  setLoading(true);
  setError('');

  const scheduledAt = `${sessionDate}T${sessionTime}:00`;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

 const payload = {
  case_id: selectedCaseId,
  psychologist_id: user.id,
  teen_id: cases.find(c => c.id === selectedCaseId)?.teen_id,
  topic: topic.trim(),
  scheduled_at: scheduledAt,
  meeting_link: zoomLink.trim(),
  psychologist_notes: description.trim() || null,
  status: 'scheduled',
  price_cents: 2900,
};
if (upcomingSession) {
  // ✅ EDIT existing session → DO NOT TOUCH payment_status
  await supabase
    .from('private_sessions')
    .update(payload)
    .eq('id', upcomingSession.id)
    .eq('psychologist_id', user.id);
} else {
  // ✅ CREATE new session
  const { count } = await supabase
    .from('private_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', selectedCaseId);

  const isFirstSession = (count ?? 0) === 0;

  await supabase.from('private_sessions').insert({
    ...payload,
    payment_status: isFirstSession ? 'paid' : 'unpaid',
  });
}

 setSuccess('Session saved successfully ✅');
setIsEditing(false); // 🔒 LOCK FORM AFTER SAVE
fetchSessionsForCase(selectedCaseId!);
};
const isSessionFormValid =
  topic.trim().length > 0 &&
  sessionDate.length > 0 &&
  sessionTime.length > 0 &&
  isValidZoomLink(zoomLink);


  // Payment placeholder (you’ll wire it later from parents dashboard)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
 const isCasePaid =
  !!selected && paidEmergencyMap.has(selected.id);
  const [alerts, setAlerts] = useState<PsychologistAlert[]>([]);
const unreadCount = alerts.filter(a => a.status === 'unread').length;


const fetchCases = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 1️⃣ Fetch cases
  const { data: casesData, error: casesError } = await supabase
    .from('cases')
    .select('*')
    .eq('psychologist_id', user.id)
    .order('opened_at', { ascending: false });

  if (casesError || !casesData) {
    console.error(casesError);
    return;
  }

  // 2️⃣ Collect teen IDs
  const teenIds = Array.from(
    new Set(casesData.map(c => c.teen_id))
  );

  // 3️⃣ Fetch teen names from users table
  let teenMap = new Map<string, string>();

  if (teenIds.length > 0) {
    const { data: teens, error: teensError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', teenIds);

    if (!teensError && teens) {
      teens.forEach(t => {
        teenMap.set(t.id, t.name);
      });
    }
  }

  // 4️⃣ Merge teen_name into cases (UI only)
  const enrichedCases = casesData.map(c => ({
    ...c,
    teen_name: teenMap.get(c.teen_id) ?? 'Teen',
  }));

  setCases(enrichedCases);
};
const fetchPsychologistAlerts = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data, error } = await supabase
    .from('psychologist_alerts')
    .select('*')
    .eq('psychologist_id', user.id)
    .order('created_at', { ascending: false });

  if (!error && data) setAlerts(data);
};
  const fetchRiskQueue = async () => {
    setRiskError('');
    setRiskLoading(true);

    try {
      // 1) Get sensitive words
      const { data: sw, error: swError } = await supabase
        .from('sensitive_words')
        .select( 'id, user_id, detected_word, confidence, source, created_at, message_id, message_table, conversation_id')
        .order('created_at', { ascending: false })
        .limit(50);

      if (swError) {
        setRiskError(swError.message);
        return;
      }

      const rows = (sw ?? []) as SensitiveWordRow[];

      // 2) Get teen names from public.users
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

      let teenMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: teens, error: teensError } = await supabase
          .from('users')
          .select('id, name')
          .in('id', userIds);

        if (!teensError && teens) {
          (teens as TeenUser[]).forEach((t) => teenMap.set(t.id, t.name));
        }
      }

      // 3) Build list
      const built: RiskItem[] = rows.map((r) => ({
        ...r,
        teen_name: teenMap.get(r.user_id) || 'Unknown Teen',
        level: getRiskLevel(r.detected_word, r.confidence),
      }));

      setRiskItems(built);
    } catch {
      setRiskError('Failed to load risk queue');
    } finally {
      setRiskLoading(false);
    }
  };
  const fetchPaidEmergencyCases = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from('emergency_cases')
    .select('id, sensitive_word_id')
    .eq('psychologist_id', user.id)
    .eq('payment_status', 'paid');

  if (error) {
    console.error(error);
    return;
  }

  const map = new Map<string, string>();
  (data ?? []).forEach(row => {
    if (row.sensitive_word_id) {
      map.set(row.sensitive_word_id, row.id);
    }
  });

  setPaidEmergencyMap(map);
};
const normalizeCommunityMessage = (m: any): ChatMessage => ({
  id: m.id,
  user_id: m.user_id,
  sender: 'user',            // community messages are always user
  content: m.message,        // 🔥 IMPORTANT
  type: 'text',
  created_at: m.created_at,
});
const normalizePrivateUserMessage = (m: any): ChatMessage => ({
  id: m.id,
  user_id: m.sender_id,
  sender: 'user',              // 🔥 FORCE USER
  content: m.message,
  type: 'text',
  created_at: m.created_at,
});
 const openRisk = async (item: RiskItem) => {
  setSelected(item);
  setChat([]);
  setChatLoading(true);
  setChatError('');

  try {
    if (!item.message_id || !item.message_table) {
      setChatError('No message reference available.');
      return;
    }



    /* ───────── 2️⃣ FETCH CONTEXT (MAX 5 TOTAL) ───────── */
    let context: any[] = [];

    if (item.message_table === 'community_messages') {
      const { data } = await supabase
        .from('community_messages')
        .select('*')
        .eq('user_id', item.user_id)
        .order('created_at', { ascending: false })
        .limit(5);

      context = (data ?? []).reverse();
    }

    if (item.message_table === 'messages') {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', item.user_id)
        .order('created_at', { ascending: false })
        .limit(5);

      context = data ?? [];
    }

   if (item.message_table === 'private_messages') {
  if (!item.conversation_id) {
    setChatError('Missing conversation reference.');
    return;
  }

  const { data, error } = await supabase
    .from('private_messages')
    .select('*')
    .eq('conversation_id', item.conversation_id)
    .eq('sender_id', item.user_id)               // ✅ USER ONLY
    .gte('created_at', item.created_at)          // ✅ START FROM FLAG
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) {
    console.error(error);
    setChatError('Failed to load messages.');
    return;
  }

  if (!data || data.length === 0) {
    setChatError('No messages found for this user.');
    return;
  }

  const normalized = data.map(normalizePrivateUserMessage);
  setChat(normalized);
}


    /* ───────── 3️⃣ NORMALIZE FOR UI ───────── */
    const normalized: ChatMessage[] = context.map((m) => {
      if (item.message_table === 'community_messages') {
        return normalizeCommunityMessage(m);
      }
      return m as ChatMessage;
    });

    setChat(normalized);
  } catch (e) {
    console.error(e);
    setChatError('Failed to load chat preview.');
  } finally {
    setChatLoading(false);
  }
};
  /**
   * Emergency action:
   * - This should notify the parents dashboard that immediate help is required.
   * - We will store it in a table you will create later (example: parent_notifications).
   *
   * ✅ This function will NOT break your app if the table doesn’t exist yet.
   */
const sendEmergencyToParents = async (item: RiskItem) => {
  if (!item) return;

  // 1) Get psychologist user
  const {
    data: { user: psychologist },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !psychologist) {
    alert('Session missing. Please log in again.');
    return;
  }

  /* ================= NEW: fetch psychologist full name ================= */
  const { data: psychProfile, error: psychErr } = await supabase
    .from('web_users')
    .select('full_name')
    .eq('id', psychologist.id)
    .single();

  const psychologistName = psychProfile?.full_name ?? 'Your psychologist';
  /* ================= END NEW ================= */

  const alertMessage = `
Dr. ${psychologistName} has identified a high-risk mental health concern for your child (${item.teen_name}).

Detected keyword: "${item.detected_word}"
Risk level: ${item.level}

Immediate attention is recommended.

To open an emergency case and receive direct professional support, a one-time emergency session fee of $29 is required.
Please click "Pay Now" to proceed with the first session.

I strongly recommend contacting me if you have any questions or need additional information.
`.trim();
const { data: existing } = await supabase
  .from('emergency_cases')
  .select('id')
  .eq('sensitive_word_id', item.id)
  .limit(1);

if (existing?.length) {
  alert('This case has already been escalated.');
  return;
}
  // 2) Insert parent alert
  const { data: alertRow, error: alertError } = await supabase
    .from('parent_alerts')
    .insert({
      child_id: item.user_id,
      detected_word: item.detected_word,
      risk_level: item.level,
      message: alertMessage,
      status: 'unread',
    })
    .select()
    .single();

  if (alertError || !alertRow) {
    console.error('Emergency insert failed:', alertError);
    alert('⚠️ An emergency case already exists for this incident.');
    return;
  }

  // 3) Insert emergency case (pending payment)
  const EMERGENCY_PRICE_CENTS = 2900;

 const { error: caseError } = await supabase.from('emergency_cases').insert({
  child_id: item.user_id,
  psychologist_id: psychologist.id,
  alert_id: alertRow.id,
  sensitive_word_id: item.id, // ✅ NEW
  status: 'pending_payment',
  payment_status: 'unpaid',
  amount_cents: EMERGENCY_PRICE_CENTS,
  currency: 'USD',
});
if (caseError) {
  if (caseError.code === '23505') {
    alert('⚠️ An emergency case already exists for this incident.');
  } else {
    console.error('Emergency case insert failed:', caseError);
    alert(
      'Alert sent, but failed to create emergency case record: ' +
        caseError.message
    );
  }
  return;
}

  alert('🚨 Emergency alert sent + case created (waiting payment).');
};
const openCase = async () => {
  if (!selected) return;

  const emergencyCaseId = paidEmergencyMap.get(selected.id);
  if (!emergencyCaseId) {
    alert('Payment not completed yet');
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 🔒 enforce max 5 open cases
const { data: openCases, error: countError } = await supabase
  .from('cases')
  .select('id', { count: 'exact', head: true })
  .eq('psychologist_id', user.id)
  .eq('status', 'open');

if (countError) {
  alert('Failed to verify open cases limit');
  return;
}

if ((openCases?.length ?? 0) >= 5) {
  alert(
    'You can only have 5 active cases at a time. Please close a case before opening a new one.'
  );
  return;
}
  const { error } = await supabase.from('cases').insert({
    psychologist_id: user.id,
    teen_id: selected.user_id,
    sensitive_word_id: selected.id,
    emergency_case_id: emergencyCaseId, // ✅ REAL FK
    detected_word: selected.detected_word,
    risk_level: selected.level,
    status: 'open',
  });

  if (error) {
    if (error.code === '23505') {
      alert('Case already exists');
    } else {
      console.error(error);
      alert(error.message);
    }
    return;
  }

  await fetchCases();
  setTab('cases');
};

const closeCase = async (caseId: string) => {
  const confirmed = window.confirm(
    'Are you sure you want to close this case?'
  );
  if (!confirmed) return;

  const { error } = await supabase
    .from('cases')
    .update({ status: 'closed' })
    .eq('id', caseId);

  if (error) {
    console.error(error);
    alert('Failed to close case');
    return;
  }

  // Refresh UI
  await fetchCases();
};

 useEffect(() => {
  if (tab === 'risk') {
    fetchRiskQueue();
    fetchPaidEmergencyCases();
  }

  if (tab === 'messages') {
    fetchPsychologistAlerts();
  }

  if (tab === 'cases') {
    fetchCases();
  }
  if (tab === 'progress') {
    fetchSessionProgress();
  }

  // ✅ ADD THIS BLOCK
  if (tab !== 'sessions') return;
  if (cases.length === 0) return; // ⛔ wait for cases

  fetchAllSessionsForCases();
  
}, [tab, cases.length]);
useEffect(() => {
  if (cases.length === 0) return;

  fetchAllSessionsForCases();
}, [cases]);

  useEffect(() => {
  const restored: Record<string, number> = {};

  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('emergency_cooldown_')) {
      const userId = key.replace('emergency_cooldown_', '');
      const value = Number(localStorage.getItem(key));
      if (!isNaN(value)) restored[userId] = value;
    }
  });

  setEmergencyCooldowns(restored);
}, []);
useEffect(() => {
  // 🔹 Always start on Risk Queue
  setTab('risk');
  localStorage.removeItem('psychologist_active_tab');

  const savedCaseId = localStorage.getItem('psychologist_selected_case');

  if (savedCaseId) {
    setSelectedCaseId(savedCaseId);
  }
}, []);
useEffect(() => {
  fetchCases(); // ✅ ALWAYS load cases once
}, []);

useEffect(() => {
  const interval = setInterval(() => {
    setEmergencyCooldowns((prev) => ({ ...prev }));
  }, 1000);
  return () => clearInterval(interval);
}, []);
useEffect(() => {
  if (!selected) return;
  fetchPaidEmergencyCases();
}, [selected]);
useEffect(() => {
  fetchPsychologistAlerts(); // ✅ fetch immediately for badge
}, []);



  const sortedRiskItems = useMemo(() => {
    // Put CRITICAL first, then HIGH, then MEDIUM
    const weight: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    return [...riskItems].sort((a, b) => {
      const w = weight[a.level] - weight[b.level];
      if (w !== 0) return w;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [riskItems]);
const openCases = cases.filter(c => c.status !== 'closed');
const closedCases = cases.filter(c => c.status === 'closed');
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#FFDBFF',
        color: '#008C33',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {/* ================= NAVBAR ================= */}
     <nav
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 60px',
    flexWrap: 'wrap',
    gap: 16,
  }}
>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={avatarIcon} style={{ width: 90 }} />
          <h1 style={{ margin: 0, fontWeight: 700 }}>Psychologist Dashboard</h1>
        </div>
<div
  style={{
    display: 'flex',
    gap: 14,
    fontSize: 16,
    fontWeight: 600,
    flexWrap: 'wrap',
    justifyContent: 'center',
  }}
>
          <NavTab active={tab === 'risk'} onClick={() => setTab('risk')}>
            🚨 Risk Queue
          </NavTab>
         <NavTab
  active={tab === 'cases'}
  onClick={() => setTab('cases')}
>
  🧠 Cases
</NavTab>
          <NavTab
  active={tab === 'sessions'}
  onClick={() => {
    setTab('sessions');
    localStorage.setItem('psychologist_active_tab', 'sessions');
  }}
>
  📅 Sessions
</NavTab>
          <NavTab active={tab === 'messages'} onClick={() => setTab('messages')}>
  🔔 Messages
  {unreadCount > 0 && (
    <span
      style={{
        backgroundColor: '#e74c3c',
        color: '#fff',
        borderRadius: '50%',
        padding: '2px 7px',
        fontSize: 12,
        fontWeight: 700,
        marginLeft: 8,
        minWidth: 20,
        display: 'inline-block',
        textAlign: 'center',
      }}
    >
      {unreadCount}
    </span>
  )}
</NavTab>
          <NavTab active={tab === 'progress'} onClick={() => setTab('progress')}>
            📈 Progress
          </NavTab>

          <span
            onClick={handleLogout}
            style={{
              cursor: 'pointer',
              color: '#e74c3c',
              fontWeight: 700,
              marginLeft: 12,
            }}
          >
            Logout
          </span>
        </div>
      </nav>

      {/* ================= CONTENT ================= */}
      <section
  style={{
    display: 'flex',
    justifyContent: 'center',
    padding: '60px 40px',
  }}
>        {/* ================= RISK QUEUE ================= */}
        {tab === 'risk' && (
          <div
  style={{
    width: '100%',
    maxWidth: 1200,
    display: 'flex',
    gap: 18,
    flexWrap: 'wrap',
  }}
>
            {/* LEFT: QUEUE */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h2 style={{ marginTop: 0 }}>🚨 High-Risk Messages Requiring Review</h2>
                <button
                  onClick={fetchRiskQueue}
                  disabled={riskLoading}
                  style={{
                    ...primaryBtn,
                    padding: '10px 16px',
                    borderRadius: 12,
                    opacity: riskLoading ? 0.7 : 1,
                  }}
                >
                  {riskLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {riskError && <p style={{ color: 'red' }}>{riskError}</p>}

              {riskLoading && <p>Loading risk queue...</p>}

              {!riskLoading && sortedRiskItems.length === 0 && (
                <Card>
                  <p style={{ margin: 0, color: '#555' }}>No sensitive words detected yet.</p>
                </Card>
              )}

              {!riskLoading &&
                sortedRiskItems.map((item) => (
                  <RiskRow
                    key={item.id}
                    item={item}
                    active={selected?.id === item.id}
                    onClick={() => openRisk(item)}
                    onEmergency={() => sendEmergencyToParents(item)}
                    onOpenCase={() => {
                      if (!paymentConfirmed) {
                        alert('Payment not confirmed yet. Parents must pay first.');
                        return;
                      }
                      alert('✅ Case opened (next step: sessions scheduling).');
                    }}
                    paymentConfirmed={paymentConfirmed}
                  />
                ))}
            </div>

            {/* RIGHT: CHAT VIEW */}
          <div
  style={{
    flex: '0 0 460px',
    width: '100%',
  }}
>
              <div
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 18,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                  minHeight: 520,
                }}
              >
                {!selected ? (
  <div style={{ color: '#555' }}>
    <h3 style={{ marginTop: 0 }}>Chat Preview</h3>
    <p>Select a flagged word to view the full ZenBot chat.</p>
  </div>
) : (
  <div>
    <h3 style={{ marginTop: 0, marginBottom: 6 }}>
      Chat for: {selected.teen_name}
    </h3>

    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={chip}>Word: {selected.detected_word}</span>
      <span style={chip}>Level: {selected.level}</span>
      <span style={chip}>Source: {selected.source}</span>
      <span style={chip}>Time: {formatTime(selected.created_at)}</span>
    </div>

    {/* 🔥 COOLDOWN LOGIC (ADDED — NO OLD LOGIC REMOVED) */}
    {(() => {
      const stored = localStorage.getItem(
        `emergency_cooldown_${selected.user_id}`
      );

      const lastClicked =
        emergencyCooldowns[selected.user_id] ||
        (stored ? Number(stored) : undefined);

      const now = Date.now();

      const isOnCooldown =
        !!lastClicked && now - lastClicked < COOLDOWN_MS;

      const remainingMs = isOnCooldown
        ? COOLDOWN_MS - (now - lastClicked)
        : 0;

      const remainingSeconds = Math.ceil(remainingMs / 1000);
      return (
        <div style={{ marginTop: 14, marginBottom: 10 }}>
          <button
            style={{
              ...dangerBtn,
              opacity: isOnCooldown ? 0.5 : 1,
              cursor: isOnCooldown ? 'not-allowed' : 'pointer',
            }}
            disabled={isOnCooldown}
            onClick={async () => {
              if (isOnCooldown || !selected) return;

              const now = Date.now();

              setEmergencyCooldowns((prev) => ({
                ...prev,
                [selected.user_id]: now,
              }));

              localStorage.setItem(
                `emergency_cooldown_${selected.user_id}`,
                now.toString()
              );

              await sendEmergencyToParents(selected);
            }}
          >
            {isOnCooldown
              ? `Emergency (${remainingSeconds}s)`
              : 'Emergency'}
          </button>

          {/* 🔹 Small helper note */}
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: '#777',
              lineHeight: 1.4,
            }}
          >
            Tap <strong>Emergency</strong> to immediately notify the parents and open a
            paid emergency session request.
          </div>

          {/* ⏱ Countdown helper text */}
          {isOnCooldown && (
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              You can send another emergency in {remainingSeconds} seconds
            </div>
          )}
        </div>
      );
    })()}

    {chatError && <p style={{ color: 'red' }}>{chatError}</p>}
    {chatLoading && <p>Loading chat...</p>}

    {!chatLoading && (
      <div
        style={{
          marginTop: 10,
          background: 'rgba(255,255,255,0.65)',
          borderRadius: 18,
          padding: 12,
          maxHeight: 360,
          overflowY: 'auto',
          border: '1px solid #f0f0f0',
        }}
      >
        {chat.length === 0 ? (
          <p style={{ color: '#555' }}>No messages found for this user.</p>
        ) : (
          chat.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  maxWidth: '78%',
                  padding: '10px 12px',
                  borderRadius: 16,
                  background: m.sender === 'user' ? '#e8f8ee' : '#f7f7f7',
                  color: '#222',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                  {m.sender.toUpperCase()} •{' '}
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>
                  {m.content}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    )}

    <div style={{ marginTop: 14 }}>
      <button
  style={{
    ...primaryBtn,
    width: '100%',
    opacity: isCasePaid ? 1 : 0.55,
    cursor: isCasePaid ? 'pointer' : 'not-allowed',
    boxShadow: isCasePaid
      ? '0 0 0 3px rgba(0,140,51,0.25)'
      : 'none',
  }}
  disabled={!isCasePaid}
  onClick={openCase}
>
  {isCasePaid
    ? 'Open Case (Payment Confirmed)'
    : 'Open Case (Waiting Payment)'}
</button>

    </div>
  </div>
)}

              </div>
            </div>
          </div>
        )}

        {/* ================= CASES (placeholder) ================= */}
    {tab === 'cases' && (
  <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto' }}>
    {/* ================= ACTIVE CASES ================= */}
    <h2 style={{ marginBottom: 24 }}>🧠 Active Cases</h2>

    <div
      style={{
        display: 'grid',
       gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 32,
        paddingTop: 20,
        animation: 'fadeIn 0.4s ease',
      }}
    >
      {openCases.map((c) => {
        const riskColor =
          c.risk_level === 'CRITICAL'
            ? '#e74c3c'
            : c.risk_level === 'HIGH'
            ? '#e67e22'
            : '#f1c40f';

        const statusColor =
          c.status === 'open'
            ? '#27ae60'
            : c.status === 'in_session'
            ? '#f39c12'
            : '#95a5a6';

        /* ✅ NEW: close-case guard */
        const bucket = sessionsByCase[c.id];
        const hasUnfinishedSession =
          !!bucket && bucket.upcoming !== null;

        return (
          <div
            key={c.id}
            style={{
              background: '#fff',
              borderRadius: 26,
              padding: 28,
              boxShadow: '0 18px 40px rgba(0,0,0,0.15)',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow =
                '0 26px 55px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                '0 18px 40px rgba(0,0,0,0.15)';
            }}
          >
            {/* Teen name */}
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>
              {c.teen_name}
            </h2>

            {/* Risk info */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <span style={chip}>{c.detected_word}</span>
              <span
                style={{
                  ...chip,
                  background: riskColor,
                  color: '#fff',
                }}
              >
                {c.risk_level}
              </span>
            </div>

            {/* Status */}
            <div style={{ marginBottom: 8, fontSize: 15 }}>
              Status:{' '}
              <strong style={{ color: statusColor }}>
                {c.status}
              </strong>
            </div>

            {/* Opened date */}
            <div style={{ fontSize: 13, color: '#777', marginBottom: 12 }}>
              Opened: {formatTime(c.opened_at)}
            </div>

            {/* Session placeholder */}
            <div
              style={{
                fontSize: 14,
                color: '#666',
                background: '#f6f6f6',
                padding: 12,
                borderRadius: 14,
                marginBottom: 18,
              }}
            >
              {sessionsByCase[c.id]?.upcoming ? (
                <div>
                  <strong>Upcoming:</strong><br />
                  {sessionsByCase[c.id].upcoming!.topic}<br />
                  {formatLocalDateTime(
                    sessionsByCase[c.id].upcoming!.scheduled_at
                  )}
                </div>
              ) : (
                <strong>No upcoming session</strong>
              )}

              {sessionsByCase[c.id]?.completed?.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <strong>Completed:</strong>
                  {sessionsByCase[c.id].completed.map((s) => (
                    <div key={s.id}>
                      {s.topic} — {formatLocalDateTime(s.scheduled_at)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule Session */}
            <button
              style={{
                ...primaryBtn,
                width: '100%',
                fontSize: 16,
                padding: '14px 18px',
                marginBottom: 12,
              }}
              onClick={() => {
                setSelectedCaseId(c.id);
                localStorage.setItem('psychologist_selected_case', c.id);

                setTab('sessions');
                localStorage.setItem(
                  'psychologist_active_tab',
                  'sessions'
                );

                fetchSessionsForCase(c.id);
              }}
            >
              📅 Schedule Session
            </button>

            {/* Close Case */}
            <button
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 14,
                border: 'none',
                background: hasUnfinishedSession ? '#bbb' : '#e74c3c',
                color: '#fff',
                fontWeight: 800,
                cursor: hasUnfinishedSession
                  ? 'not-allowed'
                  : 'pointer',
                opacity: hasUnfinishedSession ? 0.6 : 1,
              }}
              disabled={hasUnfinishedSession}
              onClick={() => {
                if (hasUnfinishedSession) return;
                closeCase(c.id);
              }}
            >
              🔒 Close Case
            </button>

            {hasUnfinishedSession && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: '#777',
                  textAlign: 'center',
                }}
              >
                ⚠️ Complete or delete scheduled sessions before closing this case
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* ================= COMPLETED CASES ================= */}
    {closedCases.length > 0 && (
      <>
        <h2 style={{ margin: '48px 0 24px', color: '#777' }}>
          ✅ Completed Cases
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
            gap: 32,
            opacity: 0.55,
          }}
        >
          {closedCases.map((c) => {
            const riskColor =
              c.risk_level === 'CRITICAL'
                ? '#e74c3c'
                : c.risk_level === 'HIGH'
                ? '#e67e22'
                : '#f1c40f';

            return (
              <div
                key={c.id}
                style={{
                  background: '#fff',
                  borderRadius: 26,
                  padding: 28,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                }}
              >
                <h2 style={{ marginTop: 0 }}>{c.teen_name}</h2>

                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <span style={chip}>{c.detected_word}</span>
                  <span
                    style={{
                      ...chip,
                      background: riskColor,
                      color: '#fff',
                    }}
                  >
                    {c.risk_level}
                  </span>
                </div>

                <div style={{ fontSize: 14 }}>
                  Status: <strong>closed</strong>
                </div>

                <div style={{ fontSize: 13, color: '#777' }}>
                  Opened: {formatTime(c.opened_at)}
                </div>
              </div>
            );
          })}
        </div>
      </>
    )}
  </div>
)}


        {/* ================= SESSIONS (placeholder) ================= */}
   {tab === 'sessions' && (
  <div style={{ maxWidth: 1320, margin: '0 auto' }}>
    {!selectedCaseId ? (
      <Card>
        <p style={{ margin: 0, color: '#555' }}>
          Please select a case and click <strong>Schedule Session</strong> from the Cases tab.
        </p>
      </Card>
    ) : (
      <div
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
    width: '100%',          // ✅ REQUIRED
    alignItems: 'stretch', // ✅ REQUIRED
  }}
>        {/* ================= FORM (UNCHANGED) ================= */}
        <div
  ref={sessionFormRef}
  style={{
    maxWidth: 820,
    width: '100%',
    margin: '0 auto',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 28,
    padding: 56,
    opacity: upcomingSession && !isEditing ? 0.6 : 1,
    transition: 'opacity 0.3s ease',
  }}
>          <h2 style={{ marginTop: 0 }}>Schedule Private Session</h2>

          <label style={labelStyle}>Session Topic</label>
          <input
            disabled={!isEditing}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Date</label>
          <input
            disabled={!isEditing}
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Time</label>
          <input
            disabled={!isEditing}
            type="time"
            value={sessionTime}
            onChange={(e) => setSessionTime(e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Zoom Meeting Link</label>
          <input
            disabled={!isEditing}
            value={zoomLink}
            onChange={(e) => setZoomLink(e.target.value)}
            style={inputStyle}
          />

          {zoomLink.length > 0 && !isValidZoomLink(zoomLink) && (
            <div style={{ color: '#e74c3c', fontSize: 13, marginBottom: 12 }}>
              Please enter a valid Zoom meeting link
            </div>
          )}

          <label style={labelStyle}>Psychologist Notes</label>
          <textarea
            disabled={!isEditing}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, minHeight: 110 }}
          />

          <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            💳 {upcomingSession
              ? 'Parent payment required before session'
              : 'First session already paid'}
          </div>

          {isEditing && (
            <button
              onClick={handleSaveSession}
              disabled={loading || !isSessionFormValid}
              style={{
                ...primaryBtn,
                opacity: loading || !isSessionFormValid ? 0.5 : 1,
              }}
            >
              {loading ? 'Saving...' : 'Save Session'}
            </button>
          )}

          {error && <p style={{ color: 'red', marginTop: 12 }}>{error}</p>}
          {success && <p style={{ color: '#008C33', marginTop: 12 }}>{success}</p>}
        </div>
        <div
  style={{
    height: 1,
    background: 'rgba(0,0,0,0.08)',
    margin: '8px auto 24px',
    width: '100%',
    maxWidth: 1000,
  }}
/>

        {/* ================= CASE CARDS (BELOW FORM) ================= */}
        <div
  style={{
    display: 'grid',
   gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 28,
    width: '100%',          // ✅ REQUIRED
    alignItems: 'stretch',
  }}
>          {cases.map((c) => {
            const bucket = sessionsByCase[c.id];
            const isCaseClosed = c.status === 'closed';
            if (!bucket) return null;

            const caseUpcomingSession = bucket.upcoming;
            const caseCompletedSessions = bucket.completed;
            const selectSessionContext = (
  caseId: string,
  session: PrivateSession
) => {
  setSelectedCaseId(caseId);
  setUpcomingSession(session);

  const dt = new Date(session.scheduled_at);
  setTopic(session.topic);
  setSessionDate(dt.toISOString().slice(0, 10));
  setSessionTime(dt.toISOString().slice(11, 16));
  setZoomLink(session.meeting_link ?? '');
  setDescription(session.psychologist_notes ?? '');

  setIsEditing(false);
  setError('');
  setSuccess('');
};


            return (
              <div
  key={c.id}
  style={{
    background: '#fff',
    borderRadius: 28,
    padding: 34,
    boxShadow: '0 18px 40px rgba(0,0,0,0.15)',

    /* ✅ CLOSED CASE VISUAL STATE */
    opacity: isCaseClosed ? 0.45 : 1,
    textDecoration: isCaseClosed ? 'line-through' : 'none',
    pointerEvents: isCaseClosed ? 'none' : 'auto',
    position: 'relative',
  }}
>
  {isCaseClosed && (
  <span
    style={{
      position: 'absolute',
      top: -10,
      right: 14,
      background: '#e74c3c',
      color: '#fff',
      fontSize: 11,
      fontWeight: 800,
      padding: '4px 10px',
      borderRadius: 999,

      // ❗ prevent the badge itself from being crossed
      textDecoration: 'none',
    }}
  >
    🔒 CASE CLOSED
  </span>
)}
                <h2 style={{ marginTop: 0 }}>{c.teen_name}</h2>

                {/* ===== UPCOMING ===== */}
                <div
  style={{
    background: '#f6f6f6',
    padding: 20,
    borderRadius: 18,
    marginBottom: 16,
  }}
>
  <strong>Upcoming Session</strong>

  {caseUpcomingSession ? (
    <>
      <div style={{ marginTop: 6, fontWeight: 700 }}>
        {caseUpcomingSession.topic}
      </div>
      <div style={{ fontSize: 14 }}>
        {formatLocalDateTime(caseUpcomingSession.scheduled_at)}
      </div>

      <div
        style={{
          marginTop: 10,
          padding: '6px 10px',
          borderRadius: 12,
          fontWeight: 700,
          background:
            caseUpcomingSession.payment_status === 'paid'
              ? '#e8f8ee'
              : '#fdecea',
          color:
            caseUpcomingSession.payment_status === 'paid'
              ? '#008C33'
              : '#c0392b',
        }}
      >
        💳 {caseUpcomingSession.payment_status.toUpperCase()}
      </div>

      {/* 🔔 PAYMENT REMINDER — ONLY IF UNPAID */}
      {caseUpcomingSession.payment_status === 'unpaid' && (
        <button
          onClick={() =>
            sendPaymentReminder(caseUpcomingSession, c)
          }
          style={{
            ...primaryBtn,
            backgroundColor: '#f39c12',
            marginTop: 10,
            width: '100%',
          }}
        >
          🔔 Send payment reminder to parent
        </button>
      )}

      <div
  style={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  }}
>        {/* MARK DONE — ONLY after 2 hours */}
        {canMarkSessionCompleted(
          caseUpcomingSession.scheduled_at,
          caseUpcomingSession.status
        ) && (
          <button
            onClick={() => {
              selectSessionContext(c.id, caseUpcomingSession);
              handleMarkSessionDone();
            }}
            style={{ ...primaryBtn, backgroundColor: '#27ae60' }}
          >
            Mark Done
          </button>
        )}

        {/* EDIT — ALWAYS */}
        <button
          onClick={() => {
            setSelectedCaseId(c.id);
            selectSessionContext(c.id, caseUpcomingSession);
            setIsEditing(true);
            setError('');
            setSuccess('');

            // ✅ SCROLL TO FORM
            setTimeout(() => {
              sessionFormRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }, 50);
          }}
          style={primaryBtn}
        >
          Edit
        </button>

        {/* DELETE — ALWAYS */}
        <button
          onClick={() => {
            selectSessionContext(c.id, caseUpcomingSession);
            handleDeletePrivateSession();
          }}
          style={{ ...primaryBtn, backgroundColor: '#e74c3c' }}
        >
          Delete
        </button>
      </div>
    </>
  ) : (
    <div style={{ marginTop: 6, color: '#777' }}>
      No upcoming session
    </div>
  )}
</div>

                {/* ===== COMPLETED ===== */}
                {caseCompletedSessions.length > 0 && (
                  <div
                    style={{
                      background: '#f6f6f6',
                      padding: 16,
                      borderRadius: 18,
                      marginBottom: 18,
                    }}
                  >
                    <strong>Completed Sessions</strong>

                    {caseCompletedSessions.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          marginTop: 10,
                          padding: 12,
                          borderRadius: 14,
                          background: '#e8f8ee',
                        }}
                      >
                        <strong>{s.topic}</strong>
                        <div style={{ fontSize: 13 }}>
                          {formatLocalDateTime(s.scheduled_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ===== SCHEDULE ANOTHER ===== */}
                <button
                  style={{ ...primaryBtn, width: '100%' }}
                 onClick={() => {
  setSelectedCaseId(c.id);
  setIsEditing(true);

  setUpcomingSession(null);
  setTopic('');
  setSessionDate('');
  setSessionTime('');
  setZoomLink('');
  setDescription('');
  setError('');
  setSuccess('');

  localStorage.setItem('psychologist_selected_case', c.id);

  // ✅ SCROLL TO FORM
  setTimeout(() => {
    sessionFormRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, 50);
}}
                >
                  📅 Schedule Session
                </button>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>
)}


        {/* ================= PARENTS (placeholder) ================= */}
        {tab === 'messages' && (
  <div style={{ width: '100%', maxWidth: 900 }}>
    <h2>🔔 Notifications</h2>

    {alerts.length === 0 && (
      <Card>No notifications yet.</Card>
    )}

    {alerts.map(alert => {
  const isRead = alert.status === 'read';

  return (
    <Card
      key={alert.id}
      style={{
        opacity: isRead ? 0.55 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      <p style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>
        {alert.message}
      </p>

      <div style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>
        {formatTime(alert.created_at)}
      </div>

      <button
        style={primaryBtn}
        onClick={async () => {
          // 🔹 Optimistic fade
          setAlerts(prev =>
            prev.map(a =>
              a.id === alert.id ? { ...a, status: 'read' } : a
            )
          );

          // 🔹 Persist read state
          await supabase
            .from('psychologist_alerts')
            .update({ status: 'read' })
            .eq('id', alert.id);

          // 🔹 Navigate to risk queue
          setTab('risk');

          // 🔹 Auto-open the related sensitive word
          const target = riskItems.find(
            r => r.id === alert.sensitive_word_id
          );
          if (target) openRisk(target);
        }}
      >
        Go to Case
      </button>
    </Card>
  );
})}


  </div>
)}


        {/* ================= PROGRESS (placeholder) ================= */}
    {tab === 'progress' && (
  <div style={{ width: '100%', maxWidth: 1100 }}>
    <h2>📈 Progress Tracking</h2>

    {/* ✅ SUCCESS MESSAGE */}
    {success && (
      <div
        style={{
          marginTop: 12,
          marginBottom: 18,
          padding: 10,
          borderRadius: 12,
          background: '#e8f8ee',
          color: '#008C33',
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        {success}
      </div>
    )}

    {cases.map(c => {
      const bucket = sessionsByCase[c.id];
      if (!bucket || bucket.completed.length === 0) return null;

      return (
        <Card key={c.id}>
          <h3 style={{ marginTop: 0 }}>{c.teen_name}</h3>

          {bucket.completed.map(session => {
            // ✅ ADD HERE (PER SESSION)
            const existingProgress = progressBySession[session.id];

            return (
              <div
                key={session.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 14,
                  marginBottom: 10,
                  borderRadius: 14,
                  background: '#f6f6f6',
                }}
              >
                <div>
                  <strong>{session.topic}</strong>
                  <div style={{ fontSize: 13, color: '#666' }}>
                    {formatLocalDateTime(session.scheduled_at)}
                  </div>
                </div>

                <button
                  style={{
                    ...primaryBtn,
                    background: existingProgress ? '#f39c12' : '#008C33',
                  }}
                  onClick={() => {
                    setProgressSession(session);

                    if (existingProgress) {
                      // ✏️ EDIT MODE
                      setPlanLevel(existingProgress.plan_level);
                      setSkillsLevel(existingProgress.skills_level);
                      setGoalsLevel(existingProgress.goals_level);
                      setProgressNotes(existingProgress.notes ?? '');
                    } else {
                      // ➕ ADD MODE
                      setPlanLevel(0);
                      setSkillsLevel(0);
                      setGoalsLevel(0);
                      setProgressNotes('');
                    }

                    setProgressModalOpen(true);
                  }}
                >
                  {existingProgress ? '✏️ Edit Progress' : '➕ Add Progress'}
                </button>
              </div>
            );
          })}
        </Card>
      );
    })}
  </div>
)}

      </section>
      {progressModalOpen && progressSession && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999,
    }}
  >
   <div
  style={{
    background: '#fff',
    borderRadius: 28,
    padding: '36px 40px',
    width: '90%',
    maxWidth: 520,
    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
    animation: 'fadeInScale 0.25s ease',
  }}
>
  {/* ===== HEADER ===== */}
  <h2 style={{ marginTop: 0, marginBottom: 6, color: '#008C33' }}>
    Session Progress
  </h2>
  <div style={{ fontSize: 14, color: '#666', marginBottom: 18 }}>
    {progressSession.topic} • Completed session
  </div>

  {/* ===== SESSION SUMMARY ===== */}
  <div
    style={{
      background: '#f6f8f7',
      borderRadius: 16,
      padding: 14,
      marginBottom: 22,
      fontSize: 14,
      color: '#444',
    }}
  >
    Adjust the sliders below to reflect the teen’s improvement during
    this session.
  </div>

  {/* ===== PROGRESS DIMENSION ===== */}
  {[
  {
    label: 'Plan',
    value: planLevel,
    setter: setPlanLevel,
    hint:
      'Plan = structure & routine.\n' +
      '0: No structure.\n' +
      '3: Partial routine.\n' +
      '5: Clear, consistent plan.',
  },
  {
    label: 'Skills',
    value: skillsLevel,
    setter: setSkillsLevel,
    hint:
      'Skills = coping & regulation.\n' +
      '0: No coping skills.\n' +
      '3: Uses some with help.\n' +
      '5: Uses skills independently.',
  },
  {
    label: 'Goals',
    value: goalsLevel,
    setter: setGoalsLevel,
    hint:
      'Goals = motivation & direction.\n' +
      '0: No goals.\n' +
      '3: Unclear or unstable goals.\n' +
      '5: Clear goals and motivation.',
  },
].map(({ label, value, setter, hint }) => (
    <div key={label} style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
       <span>
  {label}
  <InfoTip text={hint} />
</span>
        <span style={{ color: '#008C33' }}>{value}/5</span>
      </div>

      <div style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>
        {hint}
      </div>

      <input
        type="range"
        min={0}
        max={5}
        value={value}
        onChange={(e) => setter(+e.target.value)}
        style={{ width: '100%' }}
      />
    </div>
  ))}

  {/* ===== OVERALL PREVIEW ===== */}
  <div
    style={{
      marginTop: 22,
      padding: 16,
      borderRadius: 18,
      background: '#e8f8ee',
      textAlign: 'center',
      fontWeight: 700,
      color: '#008C33',
    }}
  >
    Overall Progress:{' '}
    {Math.round((planLevel + skillsLevel + goalsLevel) / 15 * 100)}%
  </div>

  {/* ===== NOTES ===== */}
  <textarea
    placeholder="Clinical notes (optional)"
    value={progressNotes}
    onChange={(e) => setProgressNotes(e.target.value)}
    style={{
      ...inputStyle,
      minHeight: 90,
      marginTop: 20,
      resize: 'vertical',
    }}
  />

  {/* ===== ACTIONS ===== */}
  <div style={{ display: 'flex', gap: 14, marginTop: 26 }}>
    <button
      style={{
        ...primaryBtn,
        flex: 1,
        fontSize: 16,
        padding: '14px 18px',
      }}
      onClick={saveSessionProgress}
    >
      Save Progress
    </button>
    <button
      style={{
        ...dangerBtn,
        flex: 1,
        fontSize: 16,
        padding: '14px 18px',
      }}
      onClick={() => setProgressModalOpen(false)}
    >
      Cancel
    </button>
  </div>
</div>
  </div>
)}
    </div>
  );
}

/* ================= UI COMPONENTS ================= */
function InfoTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      style={{
        marginLeft: 6,
        cursor: 'help',
        fontWeight: 700,
        color: '#008C33',
      }}
    >
      ℹ️
    </span>
  );
}
function NavTab({ active, onClick, children }: any) {
  return (
    <span
      onClick={onClick}
      style={{
        cursor: 'pointer',
        color: active ? '#008C33' : '#517861',
        borderBottom: active ? '3px solid #008C33' : 'none',
        paddingBottom: 4,
      }}
    >
      {children}
    </span>
  );
}

function Card({ children, style }: any) {
  return (
    <div
      style={{
        background: '#fff',
        padding: 24,
        borderRadius: 24,
        marginBottom: 16,
        boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
        transition: 'opacity 0.35s ease, background 0.35s ease',
        ...style, // ✅ IMPORTANT
      }}
    >
      {children}
    </div>
  );
}

function RiskRow({
  item,
  active,
  onClick,
  onEmergency,
  onOpenCase,
  paymentConfirmed,
}: {
  item: RiskItem;
  active: boolean;
  onClick: () => void;
  onEmergency: () => void;
  onOpenCase: () => void;
  paymentConfirmed: boolean;
}) {
  const color =
    item.level === 'CRITICAL' ? '#e74c3c' : item.level === 'HIGH' ? '#e67e22' : '#f1c40f';

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        padding: 18,
        borderRadius: 22,
        marginBottom: 14,
        borderLeft: `8px solid ${color}`,
        boxShadow: active ? '0 12px 30px rgba(0,140,51,0.25)' : '0 10px 28px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{item.teen_name}</div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Word: <strong>{item.detected_word}</strong> • Source: {item.source} • {formatTime(item.created_at)}
          </div>
        </div>

        <span
          style={{
            background: color,
            color: '#fff',
            padding: '6px 14px',
            borderRadius: 20,
            fontWeight: 800,
            fontSize: 12,
            height: 'fit-content',
          }}
        >
          {item.level}
        </span>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const chip = {
  background: '#e8f8ee',
  color: '#008C33',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700 as const,
};

const primaryBtn = {
  padding: '12px 18px',
  borderRadius: 14,
  border: 'none',
  background: '#008C33',
  color: '#FFDBFF',
  fontWeight: 800,
  cursor: 'pointer',
};

const dangerBtn = {
  padding: '12px 18px',
  borderRadius: 14,
  border: 'none',
  background: '#e74c3c',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
};
const inputStyle = {
  width: '100%',
  padding: 14,
  borderRadius: 14,
  border: 'none',
  marginBottom: 16,
};
const labelStyle = {
  fontSize: 15,
  marginBottom: 8,
  display: 'block',
  fontWeight: 500,
};

<style>
{`
/* ========== PSYCHOLOGIST DASHBOARD RESPONSIVE ========== */

@media (max-width: 1024px) {
  nav {
    padding: 16px 30px !important;
  }

  section {
    padding: 40px 30px !important;
  }
}

@media (max-width: 768px) {
  nav {
    flex-direction: column !important;
    text-align: center;
  }

  nav img {
    width: 70px !important;
  }

  nav h1 {
    font-size: 24px !important;
  }

  section {
    padding: 30px 20px !important;
  }

  h2 {
    font-size: 22px !important;
  }

  h3 {
    font-size: 20px !important;
  }

  button {
    width: 100% !important;
  }
}

@media (max-width: 480px) {
  section {
    padding: 20px 14px !important;
  }

  h1 {
    font-size: 20px !important;
  }

  p {
    font-size: 14px !important;
  }
}
`}
</style>
export default PsychologistDashboard;

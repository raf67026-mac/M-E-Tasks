import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

type Energy = 'LOW' | 'MEDIUM' | 'HIGH';
// Backend mood can be "NEUTRAL". In the UI we show it as "Normal".
// We also support legacy values ("normal" / "sad") and map them to "neutral".
type MoodValue = 'happy' | 'neutral' | 'tired';
type MoodApi = MoodValue | 'NEUTRAL' | 'normal' | 'sad';
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

// AI UI categories (tabs)
type AiCategoryId = 'overview' | 'tasks' | 'planning' | 'steps' | 'mood' | 'insights' | 'history';

type Task = {
  id: number;
  title: string;
  duration: number;
  energyLevel: Energy;
  status: TaskStatus;
};

type TasksResponse = { tasks: Task[] };

type MeResponse = {
  user?: {
    id: number;
    name?: string | null;
    username?: string | null;
    mood?: MoodApi | null;
    energy?: Energy | null;
  };
};

type MoodGetResponse = {
  mood?: MoodApi | null;
  energy?: Energy | null;
};

type MeSnapshot = {
  name?: string;
  mood?: MoodValue | '';
  energy?: Energy | '';
};

type AiLang = 'en' | 'ar';
type AiSuggestion = {
  id: string;
  category: AiCategoryId;
  en: string;
  ar: string;
  energies?: Energy[]; // if omitted, shows for all energies
};
type AiCategory = { id: AiCategoryId; en: string; ar: string; icon: string };
type AiHistoryItem = { id: string; ts: string; lang: AiLang; category: AiCategoryId; q: string; a: string; energy?: Energy; mood?: MoodValue };


@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home implements OnInit {
  meName = '';
  todayMood: MoodValue | '' = '';
  todayEnergy: Energy | '' = '';

  loading = false;
  error = '';


  // ---------- AI Popup ----------
  aiOpen = false;
  aiInput = '';
  aiAnswer = '';
  aiError = '';
  aiView: 'suggestions' | 'answer' | 'history' = 'suggestions';
  aiCatAnim = false;
  aiHistory: AiHistoryItem[] = [];
  aiLoading = false;

  // ---------- AI Smart Overview (local logic) ----------
  aiOverview = {
    score: 0,
    message: '',
    suggestion: '',
    weekly: ''
  };

  // ---------- AI (bilingual) ----------
  aiLang: AiLang = 'en';
  aiCategory: AiCategoryId = 'overview';

  aiCategories: AiCategory[] = [
    { id: 'overview', en: 'Overview', ar: 'نظرة عامة', icon: '🧭' },
    { id: 'tasks', en: 'Tasks', ar: 'المهام', icon: '✅' },
    { id: 'planning', en: 'Planning', ar: 'التخطيط', icon: '🗓️' },
    { id: 'steps', en: 'Steps', ar: 'خطوات', icon: '🪜' },
    { id: 'mood', en: 'Mood & Energy', ar: 'المزاج والطاقة', icon: '🎭' },
    { id: 'insights', en: 'Insights', ar: 'تحليلات', icon: '📊' },
    { id: 'history', en: 'History', ar: 'السجل', icon: '🕘' },
  ];

  aiSuggestions: AiSuggestion[] = [
    { id: 'prio', category: 'overview', en: 'Help me prioritize my tasks', ar: 'ساعدني أرتّب مهامي حسب الأولوية' },
    { id: 'today', category: 'overview', en: 'Plan my day based on my energy', ar: 'خطّط لي يومي بناءً على طاقتي' },
    { id: 'mooduse', category: 'overview', en: 'Suggest tasks for my current energy (use my mood & energy)', ar: 'اقترح مهام تناسب طاقتي الحالية (استخدم المزاج والطاقة)' },
    { id: 'quickwin', category: 'overview', en: 'Give me 3 quick wins I can do now', ar: 'اعطني 3 إنجازات سريعة أقدر أسويها الآن', energies: ['LOW'] },

    { id: 'next', category: 'tasks', en: 'What should I do next?', ar: 'إيش أسوي الآن؟' },
    { id: 'focus', category: 'tasks', en: 'Pick 2 deep-focus tasks for me', ar: 'اختَر لي مهمتين تركيز عميق', energies: ['HIGH'] },
    { id: 'light', category: 'tasks', en: 'Pick 3 light tasks for me', ar: 'اختَر لي 3 مهام خفيفة', energies: ['LOW'] },
    { id: 'balance', category: 'tasks', en: 'Pick balanced tasks for my energy', ar: 'اختَر لي مهام متوازنة حسب طاقتي', energies: ['MEDIUM'] },

    { id: 'timebox', category: 'planning', en: 'Create a time-boxed plan for the next 2 hours', ar: 'سوِّ لي خطة بنظام الوقت للـساعتين الجاية' },
    { id: 'pomodoro', category: 'planning', en: 'Make a Pomodoro plan for my tasks', ar: 'سوِّ لي خطة بومودورو لمهامي', energies: ['HIGH','MEDIUM'] },
    { id: 'lowplan', category: 'planning', en: 'Plan a low-energy day (light tasks + breaks)', ar: 'خطّط لي يوم طاقته منخفضة (مهام خفيفة + استراحات)', energies: ['LOW'] },

    { id: 'steps_any', category: 'steps', en: 'Break this task into steps: <task title>', ar: 'قسّم هذه المهمة لخطوات: <اسم المهمة>' },
    { id: 'steps_short', category: 'steps', en: 'Break it into small 10-min steps', ar: 'قسّمها لخطوات صغيرة (10 دقائق)' },

    { id: 'mood_tip', category: 'mood', en: 'How can I use my mood & energy today?', ar: 'كيف أستفيد من مزاجي وطاقتي اليوم؟' },
    { id: 'reset', category: 'mood', en: 'Suggest a quick reset break for my mood', ar: 'اقترح لي استراحة قصيرة تغيّر مزاجي' },
  
    // --- Insights ---
    { id: 'weekly_insights', category: 'insights', en: 'Weekly insight', ar: 'تحليل أسبوعي' },
    { id: 'score', category: 'insights', en: 'Show my productivity score', ar: 'اعرض نسبة إنتاجيتي' },
    { id: 'patterns', category: 'insights', en: 'What patterns do you notice?', ar: 'وش الأنماط اللي تلاحظها؟' },
];


  // ---------- Tasks modal preview ----------
  modalExpanded = false;
  modalPreviewLimit = 5;

  // Auto-open energy lane when coming from Mood page
  pendingAutoOpenEnergy: Energy | '' = '';
  showAutoOpenBanner = false;

  statusFilter: 'ALL' | TaskStatus = 'ALL';

  tasks: Task[] = [];
  highTasks: Task[] = [];
  mediumTasks: Task[] = [];
  lowTasks: Task[] = [];

  completedCount = 0;
  inProgressCount = 0;
  pendingCount = 0;

  toastOpen = false;
  toastText = '';
  private toastTimer: any = null;


  expandedLane: Energy | 'STATUS' | '' = '';


  private lastStatusMap = new Map<number, TaskStatus>();

  constructor(private api: ApiService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Persist AI language across reloads
    try {
      const lang = localStorage.getItem('ai_lang');
      if (lang === 'ar' || lang === 'en') this.aiLang = lang;
    } catch {}

    
    // If user came from Mood page, auto-open the selected energy lane
    try {
      const e = localStorage.getItem('me_openEnergy') as Energy | null;
      const from = localStorage.getItem('me_openFromMood');
      if (e && (e === 'HIGH' || e === 'MEDIUM' || e === 'LOW')) {
        this.pendingAutoOpenEnergy = e;
        this.showAutoOpenBanner = !!from;
      }
      localStorage.removeItem('me_openEnergy');
      localStorage.removeItem('me_openFromMood');
    } catch {}

this.applyLocalMeSnapshot();
    this.loadMe();
    this.loadTasks();
  }


  private normalizeMood(v: any): MoodValue | '' {
    if (v === null || v === undefined) return '';

    // Backend uses "NEUTRAL" / "neutral" for the default mood.
    // We store it internally as "neutral" and display it as "Normal".
    // Also map legacy values ("normal" / "sad") to "neutral".
    const s = String(v).trim().toLowerCase();
    if (s === 'neutral' || s === 'normal' || s === 'sad') return 'neutral';
    if (s === 'happy' || s === 'tired') return s as MoodValue;
    return '';
  }

  private normalizeEnergy(v: any): Energy | '' {
    if (!v) return '';
    if (v === 'LOW' || v === 'MEDIUM' || v === 'HIGH') return v;
    return '';
  }

  private applyLocalMeSnapshot(): void {
    try {
      const raw = localStorage.getItem('me_snapshot');
      if (!raw) return;
      const snap = JSON.parse(raw) as MeSnapshot;

      if (snap?.name) this.meName = String(snap.name);
      const m = this.normalizeMood(snap.mood);
      if (m) this.todayMood = m;
      const e = this.normalizeEnergy(snap.energy);
      if (e) this.todayEnergy = e;
    } catch {}
  }

  private saveLocalMeSnapshot(): void {
    try {
      const snap: MeSnapshot = {
        name: this.meName,
        mood: this.todayMood,
        energy: this.todayEnergy,
      };
      localStorage.setItem('me_snapshot', JSON.stringify(snap));
    } catch {}
  }


  loadMe(): void {
    const applyFromUser = (res: MeResponse) => {
      const u = res?.user;
      if (!u) return;

      this.meName = (u.name || u.username || '').trim();
      const m = this.normalizeMood(u.mood);
      const e = this.normalizeEnergy(u.energy);

      if (m) this.todayMood = m;
      if (e) this.todayEnergy = e;

      this.saveLocalMeSnapshot();
    };

    this.api.get<MeResponse>('/users/me', { auth: true }).subscribe({
      next: (res) => {
        applyFromUser(res);
        setTimeout(() => this.cdr.detectChanges(), 0);
      },
      error: () => {
        // fallback: /mood
        this.api.get<MoodGetResponse>('/mood', { auth: true }).subscribe({
          next: (res) => {
            const m = this.normalizeMood(res?.mood);
            const e = this.normalizeEnergy(res?.energy);
            if (m) this.todayMood = m;
            if (e) this.todayEnergy = e;
            this.saveLocalMeSnapshot();
            setTimeout(() => this.cdr.detectChanges(), 0);
          },
          error: () => {},
        });
      },
    });
  }

  // ---------------------------
  // Tasks
  // ---------------------------
  loadTasks(): void {
    this.loading = true;
    this.error = '';

    this.api.get<TasksResponse>('/tasks', { auth: true }).subscribe({
      next: (res) => {
        const raw = Array.isArray((res as any)?.tasks) ? (res as any).tasks : (Array.isArray(res as any) ? (res as any) : []);
        this.tasks = raw.map((x: any) => this.normalizeTask(x));
        this.recompute();
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }, 0);
      },
      error: () => {
        this.error = 'Could not load tasks.';
        this.tasks = [];
        this.recompute();
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }, 0);
      },
    });
  }


  private normalizeTask(x: any): Task {
    const id = typeof x?.id === 'string' ? parseInt(x.id, 10) : Number(x?.id ?? 0);

    const title = (x?.title ?? x?.name ?? x?.taskTitle ?? '').toString();

    const duration = Number(
      x?.duration ?? x?.durationHours ?? x?.hours ?? x?.estimatedHours ?? 0
    );

    const energyRaw = (x?.energyLevel ?? x?.energy ?? x?.energy_level ?? x?.energyLevelName ?? '').toString().toUpperCase();
    const energyLevel: Energy =
      energyRaw === 'HIGH' ? 'HIGH' : energyRaw === 'MEDIUM' ? 'MEDIUM' : 'LOW';

    const statusRaw = (x?.status ?? x?.state ?? '').toString().toUpperCase();
    const status: TaskStatus =
      statusRaw === 'IN_PROGRESS' ? 'IN_PROGRESS' : statusRaw === 'COMPLETED' ? 'COMPLETED' : 'PENDING';

    return { id, title, duration, energyLevel, status };
  }

  private recompute(): void {
    // lane cards always show all tasks (not affected by top status chips)
    this.highTasks = this.tasks.filter((t) => t.energyLevel === 'HIGH');
    this.mediumTasks = this.tasks.filter((t) => t.energyLevel === 'MEDIUM');
    this.lowTasks = this.tasks.filter((t) => t.energyLevel === 'LOW');

    // counts from all tasks
    this.completedCount = this.tasks.filter((t) => t.status === 'COMPLETED').length;
    this.inProgressCount = this.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    this.pendingCount = this.tasks.filter((t) => t.status === 'PENDING').length;

    this.runSmartAI();
  }

  setStatusFilter(v: 'ALL' | TaskStatus): void {
    this.statusFilter = v;
    this.recompute();
    this.closeToast();
  }

  // =============================
  // AI Pro Features (Local Smart)
  // =============================

  private aiIsAr(): boolean { return this.aiLang === 'ar'; }

  aiFmt(mins: number): string {
    const isAr = this.aiIsAr();
    const m = Math.max(0, Math.round(Number(mins) || 0));
    // Prefer days/hours/mins depending on divisibility (your duration is stored in minutes)
    if (m >= 1440 && m % 1440 === 0) {
      const d = m / 1440;
      return isAr ? `${d} يوم` : `${d} day${d === 1 ? '' : 's'}`;
    }
    if (m >= 60 && m % 60 === 0) {
      const h = m / 60;
      return isAr ? `${h} ساعة` : `${h} hour${h === 1 ? '' : 's'}`;
    }
    return isAr ? `${m} دقيقة` : `${m} min`;
  }

  private aiTaskScore(t: any, energy: Energy): number {
    // Higher score = more recommended now
    const dur = Number(t?.duration || 0);
    let s = 0;
    if (t?.status === 'IN_PROGRESS') s += 1000;
    if (t?.energyLevel === energy) s += 200;

    if (energy === 'LOW') s += Math.max(0, 120 - dur);     // shorter is better
    if (energy === 'MEDIUM') s += Math.max(0, 90 - dur);
    if (energy === 'HIGH') s += Math.min(140, dur);        // longer is ok

    if (t?.status === 'PENDING') s += 10;
    return s;
  }

  // ⭐ Productivity Score (clickable action)
  aiShowProductivityScore(): void {
    this.aiInput = this.aiIsAr() ? 'اعرض نسبة إنتاجيتي' : 'Show my productivity score';
    this.askAi();
  }

  // 🗓 Auto Plan Day (local, based on real tasks)
  aiAutoPlanDay(): void {
    const isAr = this.aiIsAr();
    const energy = (String(this.todayEnergy || 'MEDIUM').toUpperCase() as Energy);
    const all = (this.tasks || []) as any[];
    const pending = all.filter(t => t.status !== 'COMPLETED');

    // Choose a time budget based on energy (in minutes)
    const budget = energy === 'HIGH' ? 240 : (energy === 'MEDIUM' ? 180 : 120);

    const sorted = [...pending].sort((a, b) => this.aiTaskScore(b, energy) - this.aiTaskScore(a, energy));
    let used = 0;
    const chosen: any[] = [];
    for (const t of sorted) {
      const d = Number(t?.duration || 0);
      if (d <= 0) continue;
      if (used + d <= budget) {
        chosen.push(t);
        used += d;
      }
      if (used >= budget) break;
    }

    const lines = chosen.map((t, i) => {
      const step = i + 1;
      const dur = this.aiFmt(t.duration);
      const label = isAr ? `• ${t.title} (${dur})` : `• ${t.title} (${dur})`;
      return label;
    }).join('\n');

    const intro = isAr
      ? `🗓️ خطة اليوم (حسب طاقتك: ${energy})\nميزانية الوقت: ${this.aiFmt(budget)}\n`
      : `🗓️ Today plan (based on your energy: ${energy})\nTime budget: ${this.aiFmt(budget)}\n`;

    const guide = isAr
      ? `\nطريقة التنفيذ المقترحة:\n1) 25 دقيقة تركيز + 5 دقائق راحة\n2) كرري 3–5 مرات\n3) في النهاية: رتبي أول مهمة لبكرا\n`
      : `\nSuggested execution:\n1) 25 min focus + 5 min break\n2) Repeat 3–5 cycles\n3) Wrap up: set tomorrow’s first task\n`;

    const outro = isAr
      ? `\n📌 مهام مقترحة الآن (المجموع: ${this.aiFmt(used)}):\n${lines || '• ما عندك مهام متبقية—أضيفي مهمة'}`
      : `\n📌 Suggested tasks now (total: ${this.aiFmt(used)}):\n${lines || '• No remaining tasks—add a task'}`;

    // Show as answer + store history
    this.aiAnswer = `${intro}${guide}${outro}`;
    this.aiView = 'answer';

    try {
      const item = {
        ts: Date.now(),
        lang: this.aiLang,
        category: 'planning',
        q: isAr ? 'خطط لي يومي' : 'Plan my day',
        a: this.aiAnswer,
        energy: (this.todayEnergy || undefined),
        mood: (this.todayMood || undefined),
      };
      this.aiHistory.unshift(item as any);
      localStorage.setItem('ai_history', JSON.stringify(this.aiHistory.slice(0, 30)));
    } catch {}
  }

  // 🧩 Task Breakdown (choose task from list)
  aiBreakTask(task: any): void {
    const isAr = this.aiIsAr();
    if (!task) return;

    const dur = Number(task?.duration || 0);
    const e = String(task?.energyLevel || this.todayEnergy || 'MEDIUM');
    const stepsCount = dur >= 180 ? 6 : (dur >= 60 ? 5 : 4);

    // Generic step templates (works for any task title)
    const title = String(task.title || '');
    const stepsEn = [
      `Clarify the goal (what “done” means)`,
      `List the required parts / sections`,
      `Do the first small piece (quick win)`,
      `Build the main part`,
      `Review + test`,
      `Finalize + update your checklist`,
    ].slice(0, stepsCount);

    const stepsAr = [
      `حددي الهدف (إيش يعني “خلصت”)`,
      `اكتبي الأجزاء/الخطوات المطلوبة`,
      `ابدئي بأول جزء بسيط (إنجاز سريع)`,
      `أنجزي الجزء الرئيسي`,
      `مراجعة + اختبار`,
      `إنهاء + تحديث قائمة المهام`,
    ].slice(0, stepsCount);

    const header = isAr
      ? `🧩 تقسيم مهمة: ${title}\nالمدة: ${this.aiFmt(dur)} • Energy: ${e}\n\nخطوات مقترحة:`
      : `🧩 Task breakdown: ${title}\nDuration: ${this.aiFmt(dur)} • Energy: ${e}\n\nSuggested steps:`;

    const steps = (isAr ? stepsAr : stepsEn).map((s, i) => `${i + 1}) ${s}`).join('\n');

    const coach = isAr
      ? `\n\n💪 كوتش: ركزي على خطوة واحدة الآن — 15 دقيقة فقط.`
      : `\n\n💪 Coach: focus on just one step now — only 15 minutes.`;

    this.aiAnswer = `${header}\n${steps}${coach}`;
    this.aiView = 'answer';

    try {
      const item = {
        ts: Date.now(),
        lang: this.aiLang,
        category: 'steps',
        q: isAr ? `قسّم المهمة: ${title}` : `Break task: ${title}`,
        a: this.aiAnswer,
        energy: (this.todayEnergy || undefined),
        mood: (this.todayMood || undefined),
      };
      this.aiHistory.unshift(item as any);
      localStorage.setItem('ai_history', JSON.stringify(this.aiHistory.slice(0, 30)));
    } catch {}
  }

  // 📊 Weekly Insight (advanced local insight)
  aiWeeklyInsights(): void {
    const isAr = this.aiIsAr();
    const all = (this.tasks || []) as any[];
    const total = all.length;
    const completed = all.filter(t => t.status === 'COMPLETED').length;
    const inProg = all.filter(t => t.status === 'IN_PROGRESS').length;
    const pending = total - completed;

    const byE = (lvl: Energy) => all.filter(t => t.energyLevel === lvl && t.status !== 'COMPLETED').length;
    const high = byE('HIGH');
    const med = byE('MEDIUM');
    const low = byE('LOW');

    const longest = [...all].sort((a,b)=>Number(b.duration||0)-Number(a.duration||0))[0];
    const shortest = [...all].filter(t=>Number(t.duration||0)>0).sort((a,b)=>Number(a.duration||0)-Number(b.duration||0))[0];

    // AI history: last 7 days activity + most-used category
    let weekCount = 0;
    const catCount: Record<string, number> = {};
    try {
      const now = Date.now();
      const seven = now - 7 * 24 * 60 * 60 * 1000;
      for (const h of (this.aiHistory || []) as any[]) {
        if ((h?.ts || 0) >= seven) {
          weekCount++;
          const c = String(h?.category || 'other');
          catCount[c] = (catCount[c] || 0) + 1;
        }
      }
    } catch {}
    const topCat = Object.entries(catCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || '';

    const score = total ? Math.round((completed / total) * 100) : 0;

    const linesEn = [
      `Productivity this week (based on tasks now): ${score}%`,
      `Completed: ${completed} • In progress: ${inProg} • Remaining: ${pending}`,
      `Energy mix (remaining): HIGH ${high} • MEDIUM ${med} • LOW ${low}`,
      longest ? `Longest task: ${longest.title} (${this.aiFmt(longest.duration)})` : '',
      shortest ? `Quickest win: ${shortest.title} (${this.aiFmt(shortest.duration)})` : '',
      weekCount ? `AI activity (7 days): ${weekCount} chats • Top focus: ${topCat || '—'}` : '',
      `Coach tip: pick 1 HIGH task for deep focus + 2 quick wins to keep momentum.`,
    ].filter(Boolean);

    const linesAr = [
      `إنتاجيتك هذا الأسبوع (حسب مهامك الآن): ${score}%`,
      `المكتمل: ${completed} • قيد التنفيذ: ${inProg} • المتبقي: ${pending}`,
      `توزيع الطاقة (للمهام المتبقية): HIGH ${high} • MEDIUM ${med} • LOW ${low}`,
      longest ? `أطول مهمة: ${longest.title} (${this.aiFmt(longest.duration)})` : '',
      shortest ? `أسرع إنجاز: ${shortest.title} (${this.aiFmt(shortest.duration)})` : '',
      weekCount ? `نشاط الـAI (7 أيام): ${weekCount} محادثات • أكثر فئة استخدمتيها: ${topCat || '—'}` : '',
      `💪 كوتش: اختاري مهمة HIGH واحدة للتركيز + مهمتين سريعة لرفع الزخم.`,
    ].filter(Boolean);

    this.aiAnswer = (isAr ? `📊 تحليل أسبوعي\n\n${linesAr.join('\n')}` : `📊 Weekly insight\n\n${linesEn.join('\n')}`);
    this.aiView = 'answer';

    try {
      const item = {
        ts: Date.now(),
        lang: this.aiLang,
        category: 'insights',
        q: isAr ? 'تحليل أسبوعي' : 'Weekly insight',
        a: this.aiAnswer,
        energy: (this.todayEnergy || undefined),
        mood: (this.todayMood || undefined),
      };
      this.aiHistory.unshift(item as any);
      localStorage.setItem('ai_history', JSON.stringify(this.aiHistory.slice(0, 30)));
    } catch {}
  }


  // ---------------------------
  // Modal lane
  // ---------------------------
  
  get visibleActiveTasks(): Task[] {
    const all = this.activeTasks;
    return this.modalExpanded ? all : all.slice(0, this.modalPreviewLimit);
  }

  get hasMoreActiveTasks(): boolean {
    return this.activeTasks.length > this.modalPreviewLimit;
  }

  toggleModalExpand(): void {
    this.modalExpanded = !this.modalExpanded;
  }

  openAiPopup(): void {
    this.aiOpen = true;
    this.runSmartAI();
    this.aiInput = '';
    this.aiAnswer = '';
    this.aiError = '';
    this.aiView = 'suggestions';

    // Load history
    try {
      const raw = localStorage.getItem('ai_history');
      this.aiHistory = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(this.aiHistory)) this.aiHistory = [];
    } catch {
      this.aiHistory = [];
    }

    try { document.body.style.overflow = 'hidden'; } catch {}
  }

  closeAiPopup(): void {
    this.aiOpen = false;
    try { document.body.style.overflow = ''; } catch {}
  }

  setAiPrompt(p: string): void {
    this.aiInput = p;
  }

    tr(en: string, ar: string): string {
    return this.aiLang === 'ar' ? ar : en;
  }

  toggleAiLang(): void {
    this.aiLang = this.aiLang === 'en' ? 'ar' : 'en';
    try { localStorage.setItem('ai_lang', this.aiLang); } catch {}

    // Keep overview text in sync with the selected language
    this.runSmartAI();
  }

  selectAiCategory(id: AiCategoryId): void {
    this.aiCategory = id;
    this.aiAnswer = '';
    this.aiError = '';
    this.aiInput = '';
    this.aiView = (id === 'history') ? 'history' : 'suggestions';

    // Tiny animation when switching category
    this.aiCatAnim = true;
    setTimeout(() => (this.aiCatAnim = false), 220);
  }

  aiCanBack(): boolean {
    return !!this.aiAnswer || this.aiCategory !== 'overview';
  }

  aiBack(): void {
    this.aiAnswer = '';
    this.aiInput = '';
    this.aiCategory = 'overview';
  }

  getAiSuggestions(): AiSuggestion[] {
    const energy = this.todayEnergy;

    const base = this.aiSuggestions.filter((s) => {
      if (s.category !== this.aiCategory) return false;
      if (!s.energies || s.energies.length === 0) return true;
      return !!energy && (s.energies as any).includes(energy);
    });

    const dynamic = this.buildDynamicSuggestions(this.aiCategory).filter((s) => {
      if (!s.energies || s.energies.length === 0) return true;
      return !!energy && (s.energies as any).includes(energy);
    });

    // Put dynamic suggestions first (more "personal"), then fall back to base
    return [...dynamic, ...base];
  }

  aiBreakableTasks(): Task[] {
    const all = (this.tasks || []) as Task[];
    // Prefer pending first, then in-progress
    const pending = all.filter(t => t.status === 'PENDING');
    const prog = all.filter(t => t.status === 'IN_PROGRESS');
    return [...prog, ...pending];
  }



  openHistoryItem(item: AiHistoryItem): void {
    this.aiCategory = item.category || 'overview';
    this.aiInput = item.q;
    this.aiAnswer = item.a;
    this.aiError = '';
    this.aiView = 'answer';
  }

  clearAiHistory(): void {
    this.aiHistory = [];
    try { localStorage.removeItem('ai_history'); } catch {}
    this.aiView = 'history';
  }

  private buildDynamicSuggestions(categoryId: AiCategoryId): AiSuggestion[] {
    // Make suggestions more relevant based on task count + mood/energy
    const total = (this.tasks || []).length;
    const stats = this.getTaskStats();
    // Use the values already loaded on Home (from /users/me + local snapshot)
    const energy = this.todayEnergy || '';
    const mood = this.todayMood || '';

    const make = (id: string, en: string, ar: string, energies?: Energy[]): AiSuggestion => ({
      id,
      category: categoryId,
      en,
      ar,
      energies,
    });

    const out: AiSuggestion[] = [];

    // If user has no tasks
    if (total === 0) {
      if (categoryId === 'tasks' || categoryId === 'overview') {
        out.push(make('dyn_no_tasks_1',
          'I have no tasks. Suggest 3 quick tasks I can do today based on my energy.',
          'ما عندي مهام. اقترح لي ٣ مهام سريعة أقدر أسويها اليوم حسب طاقتي.'
        ));
      }
      if (categoryId === 'planning') {
        out.push(make('dyn_no_tasks_2',
          'Help me create a simple plan for today (morning / afternoon / evening).',
          'ساعدني أسوي خطة بسيطة لليوم (صباح / عصر / مساء).'
        ));
      }
      return out;
    }

    // Many pending tasks
    if (stats.pending >= 4 && (categoryId === 'tasks' || categoryId === 'overview')) {
      out.push(make('dyn_pending_1',
        'I have many pending tasks. Help me choose the top 3 to start with and why.',
        'عندي مهام كثيرة Pending. ساعدني أختار أهم ٣ أبدأ فيها وليش.'
      ));
    }

    // Many in-progress tasks
    if (stats.inProgress >= 3 && (categoryId === 'overview' || categoryId === 'planning')) {
      out.push(make('dyn_inprog_1',
        'I have multiple tasks in progress. Help me reduce context switching and finish faster.',
        'عندي أكثر من مهمة In progress. ساعدني أقلل التشتت وأخلص أسرع.'
      ));
    }

    // Energy-specific suggestions
    if (energy === 'HIGH' && categoryId === 'planning') {
      out.push(make('dyn_high_1',
        'Plan a deep-focus block (60–90 min). Which task should I do first?',
        'خطط لي جلسة تركيز (٦٠–٩٠ دقيقة). أي مهمة أبدأ فيها؟',
        ['HIGH']
      ));
    }
    if (energy === 'LOW' && categoryId === 'steps') {
      out.push(make('dyn_low_1',
        'Give me tiny steps (5–10 min each) to make progress on one task.',
        'قسّم لي مهمة لخطوات صغيرة (٥–١٠ دقائق) عشان أقدر أبدأ.',
        ['LOW']
      ));
    }
    if (energy === 'MEDIUM' && categoryId === 'tasks') {
      out.push(make('dyn_med_1',
        'Suggest a balanced mix of tasks: 1 quick win + 1 medium task + 1 prep step.',
        'اقترح مزيج متوازن: مهمة سريعة + مهمة متوسطة + خطوة تحضير.',
        ['MEDIUM']
      ));
    }

    // Mood-aware suggestion (light touch)
    if (categoryId === 'mood') {
      if (mood === 'tired') {
        out.push(make('dyn_tired_1',
          'I feel tired. Suggest low-effort tasks that still move things forward.',
          'أنا تعبانة. اقترح مهام خفيفة بس تعطي تقدم.',
          ['LOW', 'MEDIUM']
        ));
      } else if (mood === 'happy') {
        out.push(make('dyn_happy_1',
          'I feel happy. Suggest a challenge task that matches my energy.',
          'مزاجي سعيد. اقترح مهمة تحدّي تناسب طاقتي.',
          ['MEDIUM', 'HIGH']
        ));
      } else if (mood === 'neutral') {
        out.push(make('dyn_neutral_1',
          'My mood is neutral. Suggest a steady plan with short breaks.',
          'مزاجي عادي. اقترح خطة ثابتة مع فواصل قصيرة.'
        ));
      }
    }

    return out;
  }

  private getTaskStats(): { pending: number; inProgress: number; completed: number } {
    const items = this.tasks || [];
    const norm = (s: any) => String(s || '').toUpperCase();
    const pending = items.filter((t: any) => norm(t.status) === 'PENDING').length;
    const inProgress = items.filter((t: any) => norm(t.status) === 'IN_PROGRESS').length;
    const completed = items.filter((t: any) => norm(t.status) === 'COMPLETED').length;
    return { pending, inProgress, completed };
  }


  // ---------- Smart AI Overview (local / no external API) ----------
  runSmartAI(): void {
    const tasks = this.tasks || [];
    const total = tasks.length;
    const completed = tasks.filter((t: any) => t.status === 'COMPLETED').length;
    const pending = tasks.filter((t: any) => t.status !== 'COMPLETED').length;

    // ⭐ Productivity Score
    const score = total ? Math.round((completed / total) * 100) : 0;

    // Friendly coach message
    let message = '';
    if (score >= 80) message = this.tr('Great momentum! You’re on track 💪', 'ممتاز! عندك زخم قوي اليوم 💪');
    else if (score >= 50) message = this.tr('Nice progress — keep going ✨', 'تقدم جميل — كمّلي بنفس الوتيرة ✨');
    else if (pending > 0) message = this.tr('Let’s start with a small win 🚀', 'خلّينا نبدأ بإنجاز صغير 🚀');
    else message = this.tr('Add your first task to begin ✨', 'أضيفي أول مهمة عشان نبدأ ✨');

    // 🧠 Smart Suggestion (from real tasks)
    const next = tasks.find((t: any) => t.status === 'PENDING') || tasks[0];
    const suggestion = next
      ? this.tr(`Suggested task: ${next.title}`, `المهمة المقترحة: ${next.title}`)
      : this.tr('Add your first task to begin ✨', 'أضيفي أول مهمة عشان نبدأ ✨');

    // 📊 Weekly Insight (simple but realistic)
    const energy = (this.todayEnergy as Energy) || 'MEDIUM';
    const weekly =
      energy === 'HIGH'
        ? this.tr('You perform best with deep-focus tasks this week 🔥', 'هذا الأسبوع أنتِ أفضل مع مهام التركيز العالي 🔥')
        : energy === 'LOW'
        ? this.tr('Keep tasks light and achievable this week 🌿', 'خلي مهامك خفيفة وسهلة هذا الأسبوع 🌿')
        : this.tr('Balanced week ahead — steady progress ⚡', 'أسبوع متوازن — تقدم ثابت بإذن الله ⚡');

    this.aiOverview = { score, message, suggestion, weekly };
  }



  surpriseMe(): void {
    const list = this.getAiSuggestions();
    if (!list.length) return;
    const s = list[Math.floor(Math.random() * list.length)];
    this.quickAsk(this.aiLang === 'ar' ? s.ar : s.en);
  }

// Quick-action: fill the input then ask immediately
  quickAsk(p: string): void {
    this.aiInput = p;
    this.askAi();
  }

  askAi(): void {
    const qRaw = (this.aiInput || '').trim();
    if (!qRaw) return;

    this.aiLoading = true;
    this.aiError = '';

    const isAr = this.aiLang === 'ar';

    const moodKey = String(this.todayMood || 'neutral').toLowerCase(); // happy|neutral|tired
    const mood = (moodKey === 'normal' || moodKey === 'sad') ? 'neutral' : moodKey;
    const energy = (String(this.todayEnergy || 'MEDIUM').toUpperCase() as Energy);

    const all = this.tasks || [];
    const pending = all.filter(t => t.status !== 'COMPLETED');
    const inProg = all.filter(t => t.status === 'IN_PROGRESS');
    const done = all.filter(t => t.status === 'COMPLETED');

    const byEnergy = {
      HIGH: pending.filter(t => t.energyLevel === 'HIGH'),
      MEDIUM: pending.filter(t => t.energyLevel === 'MEDIUM'),
      LOW: pending.filter(t => t.energyLevel === 'LOW'),
    } as const;

    const minutes = (t: Task) => Number(t.duration || 0);
    const fmtMin = (mins: number) => {
      const m = Math.max(0, Math.round(mins));
      const h = Math.floor(m / 60);
      const r = m % 60;
      if (h <= 0) return isAr ? `${r} د` : `${r}m`;
      if (r === 0) return isAr ? `${h} س` : `${h}h`;
      return isAr ? `${h}س ${r}د` : `${h}h ${r}m`;
    };

    const list = (arr: Task[], n = 3) =>
      arr.slice(0, n).map(t => `• ${t.title} (${fmtMin(minutes(t))})`).join('\n');

    const score = (t: Task) => {
      // Higher = more recommended now
      let s = 0;
      if (t.status === 'IN_PROGRESS') s += 1000;
      // Prefer tasks that match current energy
      if (t.energyLevel === energy) s += 200;
      // If user energy is LOW, prefer shorter tasks; if HIGH prefer longer focus tasks a bit
      const d = minutes(t);
      if (energy === 'LOW') s += Math.max(0, 120 - d);         // shorter better
      if (energy === 'MEDIUM') s += Math.max(0, 90 - d);       // medium short
      if (energy === 'HIGH') s += Math.min(120, d);            // longer ok
      // Slight boost for PENDING vs COMPLETED (completed are excluded from pending anyway)
      if (t.status === 'PENDING') s += 10;
      return s;
    };

    const topTasks = (arr: Task[], n = 3) =>
      [...arr].sort((a, b) => score(b) - score(a)).slice(0, n);

    const pickByTime = (arr: Task[], budgetMin: number) => {
      // Greedy pick: recommended-first then fit into budget
      const sorted = [...arr].sort((a, b) => score(b) - score(a));
      const chosen: Task[] = [];
      let used = 0;
      for (const t of sorted) {
        const d = minutes(t) || 0;
        if (d <= 0) continue;
        if (used + d <= budgetMin) {
          chosen.push(t);
          used += d;
        }
        if (used >= budgetMin) break;
      }
      return { chosen, used };
    };

    const normalizeForMatch = (s: string) =>
      s.toLowerCase().replace(/\s+/g, ' ').trim();

    const q = normalizeForMatch(qRaw);

    // Try to map the clicked suggestion to an id
    const matched = (this.aiSuggestions || []).find(s => {
      const en = normalizeForMatch(String(s.en || ''));
      const ar = normalizeForMatch(String(s.ar || ''));
      // Allow prefix matches for "Break this task into steps: X"
      if (en && (q === en || q.startsWith(en.replace('<task title>', '').trim()))) return true;
      if (ar && (q === ar || q.startsWith(ar.replace('<اسم المهمة>', '').trim()))) return true;
      return false;
    });

    const sid = matched?.id || '';

    const header = () => {
      const eTxt = energy;
      const mTxt = mood === 'neutral' ? (isAr ? 'Neutral (Normal)' : 'Neutral (Normal)') : mood;
      if (isAr) {
        return `ملخص سريع:\n• المتبقي: ${pending.length}\n• قيد التنفيذ: ${inProg.length}\n• المكتمل: ${done.length}\n• طاقتك: ${eTxt}\n• مزاجك: ${mTxt}\n`;
      }
      return `Quick summary:\n• Remaining: ${pending.length}\n• In progress: ${inProg.length}\n• Completed: ${done.length}\n• Energy: ${eTxt}\n• Mood: ${mTxt}\n`;
    };

    const moodTip = () => {
      if (isAr) {
        if (mood === 'tired') return 'نصيحة: لأنك تعبانة، ابدئي بمهمة خفيفة 10–20 دقيقة عشان ما يصير ضغط.';
        if (mood === 'happy') return 'نصيحة: مزاجك ممتاز—استغلي الدفعة في مهمة مهمة أو صعبة شوي.';
        return 'نصيحة: خذي خطوة صغيرة الآن (25 دقيقة) وبعدين قيّمي.';
      }
      if (mood === 'tired') return 'Tip: since you feel tired, start with a light 10–20 min task to avoid burnout.';
      if (mood === 'happy') return 'Tip: great mood—use the momentum for an important or slightly harder task.';
      return 'Tip: take one small step (25 min), then reassess.';
    };

    const getTaskTitleFromColon = () => {
      const parts = qRaw.split(':');
      if (parts.length < 2) return '';
      return parts.slice(1).join(':').trim();
    };

    let answer = '';

    // --- Smart handlers ---
    if (sid === 'prio' || /priorit|order|rank|priority|ترتيب|أولو|اولو/.test(q)) {
      const base = byEnergy[energy].length ? byEnergy[energy] : pending;
      const picks = topTasks(base, 5);
      const show = list(picks, Math.min(5, picks.length));
      if (isAr) {
        answer = `${header()}\nأفضل ترتيب لك الآن:\n${show || '• ما عندك مهام متبقية — أضيفي مهمة جديدة'}\n\n${moodTip()}`;
      } else {
        answer = `${header()}\nBest next picks:\n${show || '• No remaining tasks — add a new task to get started'}\n\n${moodTip()}`;
      }
    } else if (sid === 'today' || sid === 'timebox' || /plan|schedule|today|خطة|جدول|اليوم/.test(q)) {
      const budget = sid === 'timebox' ? 120 : 240; // 2h or 4h plan
      const base = byEnergy[energy].length ? byEnergy[energy] : pending;
      const { chosen, used } = pickByTime(base, budget);
      const blocks = chosen.length ? list(chosen, chosen.length) : '';
      if (isAr) {
        answer =
          `${header()}\nخطة ${sid === 'timebox' ? 'ساعتين' : 'اليوم'} (ميزانية وقت: ${fmtMin(budget)}):\n` +
          `1) 25 دقيقة تركيز + 5 دقائق راحة\n` +
          `2) كرري 3–5 مرات حسب طاقتك\n` +
          `3) ختام خفيف + ترتيب للغد\n\n` +
          `مهام مقترحة الآن (المجموع: ${fmtMin(used)}):\n${blocks || '• أضيفي مهام عشان أقدر أخطط لك'}\n\n` +
          `${moodTip()}`;
      } else {
        answer =
          `${header()}\nPlan (${sid === 'timebox' ? 'next 2 hours' : 'today'}) (time budget: ${fmtMin(budget)}):\n` +
          `1) 25 min focus + 5 min break\n` +
          `2) Repeat 3–5 cycles\n` +
          `3) Light wrap-up + set tomorrow’s first task\n\n` +
          `Suggested tasks (total: ${fmtMin(used)}):\n${blocks || '• Add tasks so I can build a plan'}\n\n` +
          `${moodTip()}`;
      }
    } else if (sid === 'mooduse' || sid === 'mood_tip') {
      const base = byEnergy[energy].length ? byEnergy[energy] : pending;
      const picks = topTasks(base, 4);
      const show = list(picks, picks.length);
      if (isAr) {
        answer =
          `${header()}\nمهام مناسبة لطاقة ${energy} الآن:\n${show || '• ما عندك مهام متبقية—أضيفي مهمة خفيفة'}\n\n` +
          `قاعدة بسيطة:\n• HIGH = تركيز عميق\n• MEDIUM = مهام متوازنة\n• LOW = مهام خفيفة\n\n` +
          `${moodTip()}`;
      } else {
        answer =
          `${header()}\nTasks that match your ${energy} energy now:\n${show || '• No remaining tasks—add a light task'}\n\n` +
          `Simple rule:\n• HIGH = deep work\n• MEDIUM = steady progress\n• LOW = light tasks\n\n` +
          `${moodTip()}`;
      }
    } else if (sid === 'quickwin') {
      const quick = [...pending].sort((a,b)=>minutes(a)-minutes(b)).filter(t=>minutes(t)>0).slice(0,3);
      const show = list(quick, quick.length);
      answer = isAr
        ? `${header()}\n3 إنجازات سريعة الآن:\n${show || '• ما عندك مهام قصيرة — اختاري مهمة بسيطة وأبدأي 10 دقائق'}\n\n${moodTip()}`
        : `${header()}\n3 quick wins you can do now:\n${show || '• No short tasks — pick a simple one and start for 10 minutes'}\n\n${moodTip()}`;
    } else if (sid === 'next') {
      const cont = inProg[0];
      const pick = cont ? [cont] : topTasks((byEnergy[energy].length ? byEnergy[energy] : pending), 1);
      const show = pick.length ? list(pick, 1) : '';
      answer = isAr
        ? `${header()}\nالخطوة الجاية:\n${show || '• ما عندك مهام متبقية'}\n\nنصيحة: إذا تقدمي بسيط اليوم يكفي—المهم الاستمرار.`
        : `${header()}\nNext step:\n${show || '• No remaining tasks'}\n\nTip: small progress today is still progress—keep going.`;
    } else if (sid === 'focus') {
      const base = pending.filter(t => t.energyLevel === 'HIGH');
      const picks = [...base].sort((a,b)=>minutes(b)-minutes(a)).slice(0,2);
      const show = list(picks, picks.length);
      answer = isAr
        ? `${header()}\nمهمتين تركيز عميق (HIGH):\n${show || '• ما عندك مهام HIGH — جرّبي تختاري مهمة مهمة وتخليها HIGH'}\n\nاقتراح: 2 جلسات بومودورو لكل مهمة.`
        : `${header()}\n2 deep-focus tasks (HIGH):\n${show || '• No HIGH tasks — set one important task as HIGH'}\n\nSuggestion: 2 Pomodoro cycles per task.`;
    } else if (sid === 'light' || sid === 'balance') {
      const target = sid === 'light' ? 'LOW' : 'MEDIUM';
      const base = pending.filter(t => t.energyLevel === target);
      const picks = topTasks(base.length ? base : pending, 3);
      const show = list(picks, picks.length);
      answer = isAr
        ? `${header()}\nأفضل ${target} مهام لك الآن:\n${show || '• ما عندك مهام متبقية'}\n\n${moodTip()}`
        : `${header()}\nBest ${target} tasks for you now:\n${show || '• No remaining tasks'}\n\n${moodTip()}`;
    } else if (sid === 'pomodoro') {
      const base = byEnergy[energy].length ? byEnergy[energy] : pending;
      const picks = topTasks(base, 3);
      const show = list(picks, picks.length);
      answer = isAr
        ? `${header()}\nخطة بومودورو:\n• 25 دقيقة تركيز + 5 راحة (x4)\n• بعد 4 جولات: راحة 15 دقيقة\n\nابدأ بـ:\n${show || '• أضيفي مهام عشان أختار لك'}`
        : `${header()}\nPomodoro plan:\n• 25 min focus + 5 min break (x4)\n• After 4 rounds: 15 min break\n\nStart with:\n${show || '• Add tasks so I can pick for you'}`;
    } else if (sid === 'lowplan') {
      const base = pending.filter(t => t.energyLevel === 'LOW');
      const picks = [...base].sort((a,b)=>minutes(a)-minutes(b)).slice(0,5);
      const show = list(picks, picks.length);
      answer = isAr
        ? `${header()}\nخطة طاقة منخفضة:\n1) مهمة خفيفة 10–20 دقيقة\n2) استراحة قصيرة\n3) مهمة خفيفة ثانية\n\nاختيارات مناسبة:\n${show || '• ما عندك مهام LOW — جرّبي تخلين بعض المهام LOW'}\n\n${moodTip()}`
        : `${header()}\nLow-energy plan:\n1) Light task 10–20 min\n2) Short break\n3) Another light task\n\nGood picks:\n${show || '• No LOW tasks — mark a few tasks as LOW'}\n\n${moodTip()}`;
    } else if (sid === 'steps_any' || sid === 'steps_short' || /break.*steps|قسّم.*خطوات|خطوات/.test(q)) {
      const title = getTaskTitleFromColon();
      if (!title) {
        answer = isAr
          ? `اكتبي اسم المهمة بعد النقطتين عشان أقسمها لك:\nمثال: قسّم هذه المهمة لخطوات: تجهيز عرض الاجتماع`
          : `Type the task title after a colon and I’ll split it:\nExample: Break this task into steps: Prepare meeting deck`;
      } else {
        const short = sid === 'steps_short';
        const steps = short
          ? (isAr
              ? `• افتحي المهمة وحددي الهدف (2د)\n• اكتبي 3 نقاط رئيسية (8د)\n• نفذي أول نقطة (10د)\n• راجعي بسرعة (5د)\n• سجلي الخطوة التالية (2د)`
              : `• Open the task + define the goal (2m)\n• Write 3 key bullets (8m)\n• Do the first bullet (10m)\n• Quick review (5m)\n• Note the next step (2m)`)
          : (isAr
              ? `• حددي الهدف النهائي\n• اجمعي المتطلبات/المعلومات\n• قسّميها لمهام صغيرة\n• نفذي خطوة بخطوة\n• مراجعة نهائية + تسليم`
              : `• Define the end goal\n• Gather requirements/info\n• Split into small subtasks\n• Execute step by step\n• Final review + deliver`);
        answer = isAr
          ? `تفكيك المهمة: "${title}"\n${steps}\n\n${moodTip()}`
          : `Task breakdown: "${title}"\n${steps}\n\n${moodTip()}`;
      }
    } else if (sid === 'reset') {
      answer = isAr
        ? `استراحة سريعة (2–5 دقائق):\n• تنفّس 4-4-4\n• اشربي ماء\n• مشي بسيط\n\nبعدها ارجعي لمهمة خفيفة 10 دقائق ✨`
        : `Quick reset (2–5 min):\n• 4-4-4 breathing\n• Drink water\n• Short walk\n\nThen return to a light 10-min task ✨`;
    } else {
      // Generic smart fallback: give a real summary + one recommended task
      const pick = inProg.length ? [inProg[0]] : topTasks((byEnergy[energy].length ? byEnergy[energy] : pending), 1);
      const show = pick.length ? list(pick, 1) : '';
      answer = isAr
        ? `${header()}\nاقتراح سريع الآن:\n${show || '• أضيفي مهمة جديدة عشان أقدر أقترح'}\n\nقولي لي: تبغي ترتيب؟ خطة؟ ولا تقسيم مهمة؟`
        : `${header()}\nQuick suggestion right now:\n${show || '• Add a new task so I can suggest one'}\n\nTell me: do you want prioritization, a plan, or task breakdown?`;
    }

    this.aiAnswer = answer;
    this.aiLoading = false;
    this.aiView = this.aiCategory === 'history'
      ? 'history'
      : (answer ? 'answer' : 'suggestions');

    // Save to History
    if (answer) {
      const item: AiHistoryItem = {
        id: String(Date.now()),
        ts: new Date().toISOString(),
        lang: this.aiLang,
        category: this.aiCategory,
        q: qRaw,
        a: answer,
        energy: this.todayEnergy || undefined,
        mood: (this.todayMood || undefined),
      };
      this.aiHistory = [item, ...(this.aiHistory || [])].slice(0, 30);
      try { localStorage.setItem('ai_history', JSON.stringify(this.aiHistory)); } catch {}
    }
  }

  openLane(e: Energy): void {
    this.expandedLane = e;
    this.modalExpanded = false;
    // energy modal always starts unfiltered
    this.statusFilter = 'ALL';
    this.closeToast();
  }

  openStatus(s: 'ALL' | TaskStatus): void {
    this.statusFilter = s;
    this.expandedLane = 'STATUS';
    this.modalExpanded = false;
    this.closeToast();
  }

  closeLane(): void {
    const wasStatus = this.expandedLane === 'STATUS';
    this.expandedLane = '';
    if (wasStatus) {
      this.statusFilter = 'ALL';
      this.recompute();
    }
  }

  get activeTasks(): Task[] {
    if (this.expandedLane === 'STATUS') {
      return this.statusFilter === 'ALL'
        ? this.tasks
        : this.tasks.filter((t) => t.status === this.statusFilter);
    }
    if (this.expandedLane === 'HIGH') return this.highTasks;
    if (this.expandedLane === 'MEDIUM') return this.mediumTasks;
    if (this.expandedLane === 'LOW') return this.lowTasks;
    return [];
  }

  get activeLaneCount(): number {
    return this.activeTasks.length;
  }

  get activeLaneTitle(): string {
    if (this.expandedLane === 'STATUS') {
      if (this.statusFilter === 'ALL') return 'All tasks';
      if (this.statusFilter === 'PENDING') return 'Pending tasks';
      if (this.statusFilter === 'IN_PROGRESS') return 'In progress tasks';
      return 'Completed tasks';
    }
    if (this.expandedLane === 'HIGH') return 'High energy tasks';
    if (this.expandedLane === 'MEDIUM') return 'Medium energy tasks';
    if (this.expandedLane === 'LOW') return 'Low energy tasks';
    return 'Tasks';
  }

  // ---------------------------
  // Status pill
  // ---------------------------
  statusLabel(s: TaskStatus): string {
    if (s === 'PENDING') return 'Pending';
    if (s === 'IN_PROGRESS') return 'In progress';
    return 'Completed';
  }

  statusPillClass(s: TaskStatus): string {
    if (s === 'PENDING') return 'pill pending';
    if (s === 'IN_PROGRESS') return 'pill progress';
    return 'pill done';
  }

  /**
   * Task duration is stored as minutes.
   * Display smartly:
   * - divisible by 1440 => days
   * - divisible by 60   => hours
   * - otherwise         => minutes
   */
  durationLabel(minutes: number): string {
    if (minutes === null || minutes === undefined) return '—';

    const m = Number(minutes);
    if (!Number.isFinite(m) || m < 0) return '—';
    if (m === 0) return '0 mins';

    const DAY = 1440;
    const HOUR = 60;

    if (m % DAY === 0) {
      const d = m / DAY;
      return d === 1 ? '1 day' : `${d} days`;
    }

    if (m % HOUR === 0) {
      const h = m / HOUR;
      return h === 1 ? '1 hour' : `${h} hours`;
    }

    return m === 1 ? '1 min' : `${m} mins`;
  }

  moodLabel(m: MoodValue | ''): string {
    if (!m) return '—';
    const map: Record<MoodValue, string> = { happy: 'Happy', neutral: 'Normal', tired: 'Tired' };
    return map[m];
  }

  energyLabel(e: Energy | ''): string {
    if (!e) return '—';
    const map: Record<Energy, string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
    return map[e];
  }

  // ---------------------------
  // Task interactions
  // ---------------------------
  onTaskClick(t: Task, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.toggleStatus(t);
  }

  onTaskDoubleClick(t: Task, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.router.navigate(['/add-task'], { queryParams: { edit: t.id } });
  }

  private toggleStatus(t: Task): void {
    const prev = t.status;
    this.lastStatusMap.set(t.id, prev);

    let next: TaskStatus = 'PENDING';
    if (prev === 'PENDING') next = 'IN_PROGRESS';
    else if (prev === 'IN_PROGRESS') next = 'COMPLETED';
    else next = 'PENDING';

    t.status = next;
    this.recompute();

    this.api.patch(`/tasks/${t.id}`, { status: next }, { auth: true }).subscribe({
      next: () => this.showToast('Updated'),
      error: () => {
        t.status = prev;
        this.recompute();
        this.showToast('Could not update');
      },
    });
  }

  undoLastStatus(t: Task, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();

    // If user never toggled the dot, we still "undo" by cycling backwards.
    const remembered = this.lastStatusMap.get(t.id);

    const current = t.status;
    const prev: TaskStatus = remembered
      ? remembered
      : current === 'COMPLETED'
      ? 'IN_PROGRESS'
      : current === 'IN_PROGRESS'
      ? 'PENDING'
      : 'PENDING';

    if (prev === current) return;

    t.status = prev;
    this.recompute();

    this.api.patch(`/tasks/${t.id}`, { status: prev }, { auth: true }).subscribe({
      next: () => {
        // clear remembered history once used
        this.lastStatusMap.delete(t.id);
        this.showToast('Undone');
      },
      error: () => {
        t.status = current;
        this.recompute();
        this.showToast('Could not undo');
      },
    });
  }

  // ---------------------------
  // Toast
  // ---------------------------
  closeToast(): void {
    this.toastOpen = false;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
  }

  private showToast(msg: string): void {
    this.toastText = msg;
    this.toastOpen = true;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastOpen = false), 2000);
  }

  goMood(): void {
    this.router.navigateByUrl('/mood');
  }


  goProfile(): void {
    this.router.navigateByUrl('/edit-profile');
  }


  logout(): void {
    try {
      localStorage.removeItem('token');
    } catch {}
    this.router.navigateByUrl('/auth');
  }

  goAddTask(): void {
    this.router.navigateByUrl('/add-task');
  }


  openChatGPT(): void {
    window.open('https://chat.openai.com', '_blank');
  }


  deleteTask(id: number, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();

    const before = [...this.tasks];
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.recompute();

    this.api.delete(`/tasks/${id}`, { auth: true }).subscribe({
      next: () => this.showToast('Deleted'),
      error: () => {
        this.tasks = before;
        this.recompute();
        this.showToast('Could not delete');
      },
    });
  }

}
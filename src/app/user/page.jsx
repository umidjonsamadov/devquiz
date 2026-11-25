'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Zap, Target, Flame, Trophy, Calendar, Mail, TrendingUp, Star, Award,
    CheckCircle, XCircle, Settings, Clock, Crown, Medal, Sparkles, Lock, BookOpen,
} from 'lucide-react';
import { formatDuration, isOnlineNow } from '../../lib/formatDuration';

/* ── Avatar rang mavzulari (banner + halqa uchun) ── */
const THEMES = {
    green:  { a: '#4ade80', b: '#166534', c: '#052e16' },
    blue:   { a: '#60a5fa', b: '#1e40af', c: '#172554' },
    purple: { a: '#c084fc', b: '#6b21a8', c: '#3b0764' },
    orange: { a: '#fb923c', b: '#9a3412', c: '#431407' },
    red:    { a: '#f87171', b: '#991b1b', c: '#450a0a' },
    pink:   { a: '#f472b6', b: '#9d174d', c: '#500724' },
    yellow: { a: '#facc15', b: '#854d0e', c: '#422006' },
    cyan:   { a: '#22d3ee', b: '#155e75', c: '#083344' },
};

const DAY_LABELS = { Mon: 'Du', Tue: 'Se', Wed: 'Ch', Thu: 'Pa', Fri: 'Ju', Sat: 'Sh', Sun: 'Ya' };

function getLevelInfo(xp) {
    let level = 1;
    let accumulated = 0;
    while (accumulated + level * 500 <= xp) {
        accumulated += level * 500;
        level++;
    }
    const xpInLevel = xp - accumulated;
    const xpNeeded = level * 500;
    return { level, xpInLevel, xpNeeded, percent: Math.round((xpInLevel / xpNeeded) * 100) };
}

function getRankTitle(level) {
    if (level < 2) return 'Yangi boshlovchi';
    if (level < 5) return "O'quvchi";
    if (level < 10) return 'Bilimdon';
    if (level < 20) return 'Usta';
    return 'Afsona';
}

/* ── Aylana (donut) progress ── */
function Ring({ percent, size, stroke, color, track = '#1f2937', children }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
                <circle
                    cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                    strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
                    style={{ transition: 'stroke-dashoffset 0.9s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">{children}</div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, sub, iconCls }) {
    return (
        <div className="group bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconCls}`}>
                <Icon className="w-[18px] h-[18px]" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-white leading-tight">{value ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            {sub && <p className="text-[11px] text-gray-600 mt-1">{sub}</p>}
        </div>
    );
}

function Section({ title, subtitle, right, children }) {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <h3 className="font-semibold text-white text-sm sm:text-base">{title}</h3>
                    {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
                </div>
                {right}
            </div>
            {children}
        </div>
    );
}

function Pill({ icon: Icon, children, cls = 'bg-gray-800/80 text-gray-300 border-gray-700' }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1 rounded-full ${cls}`}>
            <Icon size={12} /> {children}
        </span>
    );
}

export default function UserProfile() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [challenges, setChallenges] = useState([]);

    useEffect(() => {
        async function load() {
            try {
                const [meRes, chalRes] = await Promise.all([
                    fetch('/api/auth/me'),
                    fetch('/api/user/challenges'),
                ]);
                if (!meRes.ok) { setError('Foydalanuvchi topilmadi'); return; }
                const { user } = await meRes.json();
                setUser(user);
                if (chalRes.ok) {
                    const d = await chalRes.json();
                    if (d?.challenges) setChallenges(d.challenges);
                }
            } catch {
                setError('Serverga ulanishda xato');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-gray-950">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Yuklanmoqda…</p>
            </div>
        </div>
    );

    if (error || !user) return (
        <div className="flex items-center justify-center min-h-screen bg-gray-950">
            <p className="text-red-400 text-sm">{error || 'Xato yuz berdi'}</p>
        </div>
    );

    const xp = user.xp || 0;
    const { level, xpInLevel, xpNeeded, percent } = getLevelInfo(xp);
    const questionsSolved = user.questionsSolved || 0;
    const correctAnswers = user.correctAnswers || 0;
    const incorrectAnswers = Math.max(0, questionsSolved - correctAnswers);
    const accuracy = questionsSolved > 0 ? Math.round((correctAnswers / questionsSolved) * 100) : 0;
    const dayStreak = user.dayStreak || 0;
    const timeSpent = user.timeSpent || 0;
    const theme = THEMES[user.avatarColor] || THEMES.green;
    const online = isOnlineNow(user.lastSeen);

    /* Oxirgi 7 kun faolligi */
    const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();
    const activityMap = {};
    (user.activity || []).forEach(a => {
        const key = new Date(a.date).toLocaleDateString('en-US', { weekday: 'short' });
        activityMap[key] = (activityMap[key] || 0) + (a.xp || 0);
    });
    const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = days[(today - 6 + i + 7) % 7];
        return { day: d, xp: activityMap[d] || 0, isToday: d === todayKey };
    });
    const maxDayXp = Math.max(...last7.map(d => d.xp), 1);
    const weekXp = last7.reduce((s, d) => s + d.xp, 0);

    const joinedDate = user.joinedAt
        ? new Date(user.joinedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
        : '—';

    /* Yutuqlar: value/target — qulflanganlarda progress ko'rsatiladi */
    const achievements = [
        { label: 'Birinchi Qadam', desc: '1 ta savol yechildi',  icon: Star,     value: questionsSolved, target: 1 },
        { label: 'Quiz Jangchisi', desc: '10 ta savol yechildi', icon: Award,    value: questionsSolved, target: 10 },
        { label: 'Yuzlik',         desc: '100 ta savol yechildi', icon: Medal,   value: questionsSolved, target: 100 },
        { label: 'XP Ovchisi',     desc: "100 XP to'plandi",     icon: Zap,      value: xp,              target: 100 },
        { label: 'XP Qiroli',      desc: "1000 XP to'plandi",    icon: Crown,    value: xp,              target: 1000 },
        { label: 'Olov!',          desc: '3 kunlik streak',      icon: Flame,    value: dayStreak,       target: 3 },
        { label: 'Aniq Nishon',    desc: "80%+ to'g'ri (5+ savol)", icon: Target,
          value: accuracy >= 80 ? Math.min(questionsSolved, 5) : Math.min(questionsSolved, 4), target: 5 },
        { label: 'Veteran',        desc: 'Level 5 ga yetildi',   icon: Trophy,   value: level,           target: 5 },
        { label: 'Sodiq',          desc: 'Saytda 1 soat',        icon: Clock,    value: timeSpent,       target: 3600 },
        { label: "O'jar",          desc: 'Saytda 10 soat',       icon: BookOpen, value: timeSpent,       target: 36000 },
    ].map(a => ({ ...a, earned: a.value >= a.target, pct: Math.min(100, Math.round((a.value / a.target) * 100)) }));
    const earnedCount = achievements.filter(a => a.earned).length;

    const doneChallenges = challenges.filter(c => c.completed).length;

    return (
        <div className="p-3 sm:p-6 space-y-4 bg-gray-950 min-h-screen">

            {/* ───────── Hero ───────── */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden">
                {/* Banner */}
                <div
                    className="h-28 sm:h-40 relative"
                    style={{
                        background: `radial-gradient(circle at 18% 25%, ${theme.b} 0%, transparent 55%),
                                     radial-gradient(circle at 88% 80%, ${theme.a}40 0%, transparent 50%),
                                     linear-gradient(135deg, ${theme.c}, #0b1220)`,
                    }}
                >
                    <div
                        className="absolute inset-0 opacity-[0.07]"
                        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '18px 18px' }}
                    />
                    <Link
                        href="/settings"
                        className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-white/90 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur border border-white/10 px-3 py-1.5 rounded-xl transition-colors no-underline"
                    >
                        <Settings size={13} /> Sozlamalar
                    </Link>
                </div>

                <div className="px-4 sm:px-8 pb-5 sm:pb-7">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                        {/* Avatar + level halqasi (faqat avatar bannerga tushadi) */}
                        <div className="relative z-10 shrink-0 self-start -mt-14 sm:-mt-16">
                            <Ring percent={percent} size={112} stroke={5} color={theme.a} track="#111827">
                                <div
                                    className="w-[92px] h-[92px] rounded-full overflow-hidden flex items-center justify-center text-4xl font-extrabold border-4 border-gray-900"
                                    style={{ background: `linear-gradient(135deg, ${theme.b}, ${theme.c})`, color: theme.a }}
                                >
                                    {user.avatarUrl
                                        ? <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                                        : (user.username || 'U').charAt(0).toUpperCase()}
                                </div>
                            </Ring>
                            <div
                                className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border-2 border-gray-900 text-gray-950"
                                style={{ background: theme.a }}
                            >
                                LV {level}
                            </div>
                            {online && (
                                <span className="absolute top-2 right-2 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-gray-900" title="Online" />
                            )}
                        </div>

                        {/* Ism va ma'lumotlar */}
                        <div className="flex-1 min-w-0 sm:pb-1">
                            {/* Ism + unvon (chapda) va Jami XP (o'ngda) — bitta qatorda */}
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white truncate drop-shadow">{user.username}</h1>
                                    <span
                                        className="text-xs font-bold px-2.5 py-1 rounded-full border"
                                        style={{ color: theme.a, borderColor: `${theme.a}55`, background: `${theme.a}15` }}
                                    >
                                        {getRankTitle(level)}
                                    </span>
                                </div>

                                <div className="flex flex-col items-start sm:items-end shrink-0">
                                    <div className="flex items-center gap-1.5">
                                        <Zap size={22} style={{ color: theme.a }} />
                                        <span className="text-3xl sm:text-4xl font-black text-white">{xp.toLocaleString()}</span>
                                    </div>
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Jami XP</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {user.email && <Pill icon={Mail}>{user.email}</Pill>}
                                <Pill icon={Calendar}>{joinedDate}</Pill>
                                <Pill icon={Flame} cls="bg-orange-900/20 text-orange-300 border-orange-900/50">{dayStreak} kunlik streak</Pill>
                                <Pill icon={Clock} cls="bg-purple-900/20 text-purple-300 border-purple-900/50">{formatDuration(timeSpent)}</Pill>
                            </div>
                        </div>
                    </div>

                    {/* Level progress */}
                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-1.5 text-xs">
                            <span className="text-gray-400 font-medium">Level {level} → {level + 1}</span>
                            <span className="font-semibold" style={{ color: theme.a }}>
                                {xpInLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP
                            </span>
                        </div>
                        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${theme.b}, ${theme.a})` }}
                            />
                        </div>
                        <p className="text-xs text-gray-600 mt-1.5">
                            Keyingi levelgacha {(xpNeeded - xpInLevel).toLocaleString()} XP qoldi
                        </p>
                    </div>
                </div>
            </div>

            {/* ───────── Stat kartalar ───────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Target}  label="Yechilgan savollar" value={questionsSolved}
                          sub={`${correctAnswers} ta to'g'ri`} iconCls="bg-blue-500/10 text-blue-400" />
                <StatCard icon={TrendingUp} label="Aniqlik" value={`${accuracy}%`}
                          sub={`${incorrectAnswers} ta xato`} iconCls="bg-green-500/10 text-green-400" />
                <StatCard icon={Zap} label="Bugungi XP" value={`+${user.dailyXp || 0}`}
                          sub={`Haftalik: +${weekXp} XP`} iconCls="bg-yellow-500/10 text-yellow-400" />
                <StatCard icon={Clock} label="Saytda vaqt" value={formatDuration(timeSpent)}
                          sub={online ? '🟢 Hozir online' : undefined} iconCls="bg-purple-500/10 text-purple-400" />
            </div>

            {/* ───────── Faollik + Aniqlik ───────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                    <Section
                        title="Haftalik faollik"
                        subtitle="So'nggi 7 kun · olingan XP"
                        right={
                            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border"
                                  style={{ color: theme.a, borderColor: `${theme.a}40`, background: `${theme.a}12` }}>
                                <Zap size={11} /> {weekXp} XP
                            </span>
                        }
                    >
                        <div className="flex items-end gap-2 sm:gap-3 h-40">
                            {last7.map(({ day, xp: dayXp, isToday }) => {
                                const h = dayXp > 0 ? Math.max(8, Math.round((dayXp / maxDayXp) * 100)) : 4;
                                return (
                                    <div key={day} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5" title={`${dayXp} XP`}>
                                        <span className="text-[10px] text-gray-500 h-3 leading-none">{dayXp > 0 ? `+${dayXp}` : ''}</span>
                                        <div className="w-full flex-1 flex items-end">
                                            <div
                                                className="w-full rounded-t-lg rounded-b-sm transition-all duration-700"
                                                style={{
                                                    height: `${h}%`,
                                                    background: dayXp > 0
                                                        ? `linear-gradient(180deg, ${theme.a}, ${theme.b})`
                                                        : '#1f2937',
                                                    opacity: isToday || dayXp === 0 ? 1 : 0.75,
                                                    boxShadow: isToday && dayXp > 0 ? `0 0 14px ${theme.a}55` : 'none',
                                                }}
                                            />
                                        </div>
                                        <span className={`text-[11px] sm:text-xs ${isToday ? 'text-white font-bold' : 'text-gray-600'}`}>
                                            {DAY_LABELS[day] || day}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </Section>
                </div>

                <Section title="Javoblar aniqligi" subtitle="Barcha vaqt bo'yicha">
                    <div className="flex flex-col items-center gap-4">
                        <Ring percent={accuracy} size={132} stroke={11} color="#4ade80" track="#7f1d1d55">
                            <div className="text-center">
                                <p className="text-3xl font-black text-white leading-none">{accuracy}%</p>
                                <p className="text-[11px] text-gray-500 mt-1">to'g'ri</p>
                            </div>
                        </Ring>
                        <div className="w-full grid grid-cols-2 gap-2">
                            <div className="bg-green-900/15 border border-green-900/40 rounded-xl p-2.5 text-center">
                                <CheckCircle size={14} className="text-green-400 mx-auto mb-1" />
                                <p className="text-white font-bold text-sm">{correctAnswers}</p>
                                <p className="text-[11px] text-gray-500">To'g'ri</p>
                            </div>
                            <div className="bg-red-900/15 border border-red-900/40 rounded-xl p-2.5 text-center">
                                <XCircle size={14} className="text-red-400 mx-auto mb-1" />
                                <p className="text-white font-bold text-sm">{incorrectAnswers}</p>
                                <p className="text-[11px] text-gray-500">Noto'g'ri</p>
                            </div>
                        </div>
                    </div>
                </Section>
            </div>

            {/* ───────── Kunlik vazifalar ───────── */}
            <Section
                title="Kunlik vazifalar"
                subtitle="Har kuni yangilanadi · bajarsangiz XP olasiz"
                right={
                    <span className="text-xs font-semibold text-green-400 bg-green-900/30 border border-green-900/50 px-2.5 py-1 rounded-xl">
                        {doneChallenges} / {challenges.length}
                    </span>
                }
            >
                {challenges.length === 0 ? (
                    <p className="text-gray-600 text-sm">Yuklanmoqda…</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {challenges.map((ch, i) => {
                            const pct = Math.min(100, Math.round(((ch.progress || 0) / ch.target) * 100));
                            return (
                                <div key={i} className={`rounded-2xl border p-4 ${
                                    ch.completed ? 'bg-green-900/15 border-green-800/50' : 'bg-gray-800/40 border-gray-700/50'
                                }`}>
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className={`text-sm font-semibold ${ch.completed ? 'text-green-400' : 'text-white'}`}>{ch.title}</span>
                                        {ch.completed
                                            ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                                            : <span className="flex items-center gap-0.5 text-xs font-bold text-gray-400 shrink-0"><Zap size={10} />+{ch.xpReward}</span>}
                                    </div>
                                    <p className="text-xs text-gray-500 mb-3">{ch.description}</p>
                                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${ch.completed ? 'bg-green-500' : 'bg-blue-500'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-1.5 text-right">
                                        {Math.min(ch.progress || 0, ch.target)} / {ch.target}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>

            {/* ───────── Yutuqlar ───────── */}
            <Section
                title="Yutuqlar"
                subtitle={`${earnedCount} / ${achievements.length} ta ochilgan`}
                right={
                    <div className="flex items-center gap-1 text-xs font-semibold text-yellow-400 bg-yellow-900/20 border border-yellow-900/40 px-2.5 py-1 rounded-xl">
                        <Trophy size={11} /> {earnedCount}
                    </div>
                }
            >
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                    {achievements.map(({ label, desc, earned, icon: Icon, pct }) => (
                        <div
                            key={label}
                            className={`relative flex flex-col items-center text-center p-3 sm:p-4 rounded-2xl border transition-colors ${
                                earned ? 'bg-gradient-to-b from-yellow-900/20 to-gray-900 border-yellow-800/50' : 'bg-gray-800/30 border-gray-800'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 ${
                                earned ? 'bg-yellow-500/15 border border-yellow-600/50' : 'bg-gray-800 border border-gray-700'
                            }`}>
                                {earned
                                    ? <Icon size={22} className="text-yellow-400" />
                                    : <Lock size={16} className="text-gray-600" />}
                            </div>
                            <p className={`text-xs sm:text-sm font-semibold ${earned ? 'text-white' : 'text-gray-500'}`}>{label}</p>
                            <p className={`text-[11px] leading-tight mt-0.5 ${earned ? 'text-gray-400' : 'text-gray-600'}`}>{desc}</p>
                            {earned ? (
                                <span className="mt-2 flex items-center gap-1 text-[11px] text-yellow-400 font-bold">
                                    <Sparkles size={11} /> Olingan
                                </span>
                            ) : (
                                <div className="w-full mt-2">
                                    <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-gray-500 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                    <p className="text-[10px] text-gray-600 mt-1">{pct}%</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
}

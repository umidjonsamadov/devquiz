'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleCheck, Plus, Lock, Search, Shuffle, ArrowUpDown, Users, Eye, ThumbsUp, ThumbsDown, MessageSquare, Flame, Clock } from 'lucide-react';
import TrainLock from '../../components/trainLock';
import TrainDailyChart from '../../components/trainDailyChart';
import { DIFFICULTY, LANGUAGES, CREATE_LEVEL, dailySeries, solveStreaks } from '../../lib/train';

const TEXT = { Easy: 'text-teal-400', Medium: 'text-yellow-400', Hard: 'text-red-400' };
const BAR = { Easy: 'bg-teal-400', Medium: 'bg-yellow-400', Hard: 'bg-red-500' };
const STROKE = { Easy: '#2dd4bf', Medium: '#facc15', Hard: '#ef4444' };
const RANK = { Easy: 1, Medium: 2, Hard: 3 };

const ROW = 'grid items-center gap-3 px-4 grid-cols-[20px_minmax(0,1fr)_56px] md:grid-cols-[20px_minmax(0,1fr)_150px_80px_64px_48px] 2xl:grid-cols-[20px_minmax(0,1fr)_150px_200px_80px_64px_48px]';

// Ko'rishlar, like, dislike va izohlar soni
function Engagement({ p, className = '' }) {
    return (
        <span className={`items-center gap-3 text-[11px] text-gray-500 ${className}`}>
            {[[Eye, p.views, "Ko'rganlar"], [ThumbsUp, p.likes, 'Like'], [ThumbsDown, p.dislikes, 'Dislike'], [MessageSquare, p.comments, 'Izohlar']]
                .map(([Icon, value, label]) => (
                    <span key={label} title={label} className="flex items-center gap-1"><Icon size={12} /> {value}</span>
                ))}
        </span>
    );
}
const selectCls = 'bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:ring-1 focus:ring-gray-600';

// Hali nashr qilinmagan masala: ochib bo'lmaydi
function ComingSoonRow({ p, striped }) {
    return (
        <div aria-disabled="true" className={`${ROW} py-3 cursor-default ${striped ? 'bg-gray-800/40' : ''}`}>
            <Clock size={15} className="text-gray-600" />
            <div className="min-w-0">
                <p className="text-sm text-gray-500 truncate">{p.number}. Coming soon</p>
                <p className="text-[11px] text-gray-600 truncate">Bu masala hozircha yo&apos;q, tez orada qo&apos;shiladi</p>
            </div>
            <div className="hidden md:flex gap-1 overflow-hidden">
                {p.languages.map(l => (
                    <span key={l} className="px-2 py-0.5 rounded-full bg-gray-800 text-[11px] text-gray-500">{LANGUAGES[l]}</span>
                ))}
            </div>
            <span className="hidden 2xl:block" />
            <span className="hidden md:block" />
            <span className={`text-right text-xs font-semibold opacity-50 ${TEXT[p.difficulty]}`}>{DIFFICULTY[p.difficulty].label}</span>
            <span className="hidden md:block" />
        </div>
    );
}

// Yechilgan masalalar doirasi: har bir qiyinlik o'z rangida
function ProgressRing({ stats, solved, total }) {
    const R = 52, C = 2 * Math.PI * R;
    let offset = 0;
    return (
        <div className="relative w-36 h-36 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r={R} fill="none" stroke="#1f2937" strokeWidth="8" />
                {stats.map(s => {
                    const len = total ? (s.solved / total) * C : 0;
                    const start = offset;
                    offset += len;
                    return len > 0 && (
                        <circle key={s.key} cx="60" cy="60" r={R} fill="none" stroke={STROKE[s.key]} strokeWidth="8"
                            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-start} />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-white font-bold text-2xl leading-none">{solved}<span className="text-gray-500 text-sm">/{total}</span></p>
                <p className="text-xs text-gray-500 mt-1.5">Yechilgan</p>
            </div>
        </div>
    );
}

export default function TrainPage() {
    const router = useRouter();
    const [data, setData] = useState(null);
    const [locked, setLocked] = useState(null);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [language, setLanguage] = useState('all');
    const [difficulty, setDifficulty] = useState('all');
    const [status, setStatus] = useState('all');
    const [sort, setSort] = useState('number'); // number | difficulty | solved

    useEffect(() => {
        fetch('/api/train/problems')
            .then(async (res) => {
                const d = await res.json();
                if (d.locked) setLocked(d);
                else if (!res.ok) setError(d.message || 'Xatolik yuz berdi');
                else setData(d);
            })
            .catch(() => setError("Serverga ulanib bo'lmadi"));
    }, []);

    if (locked) return <TrainLock level={locked.level} xp={locked.xp} />;
    if (error) return <p className="text-center text-red-400 py-20 text-sm">{error}</p>;
    if (!data) return (
        <div className="flex items-center justify-center min-h-screen bg-gray-950">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    // API yangisidan boshlab qaytaradi; tartib raqami eng eskisidan sanaladi
    const count = data.problems.length;
    const problems = data.problems.map((p, i) => ({ ...p, number: count - i }));
    // Natija faqat nashr qilingan masalalardan hisoblanadi
    const released = problems.filter(p => !p.comingSoon && p.published);
    const total = released.length;
    const solvedCount = released.filter(p => p.solved).length;
    const pending = problems.filter(p => p.published === false).length;
    const stats = Object.keys(DIFFICULTY).map(key => {
        const all = released.filter(p => p.difficulty === key);
        return { key, total: all.length, solved: all.filter(p => p.solved).length };
    });
    const earned = stats.reduce((sum, s) => sum + s.solved * DIFFICULTY[s.key].xp, 0);

    const compare = {
        number: (a, b) => a.number - b.number,
        difficulty: (a, b) => RANK[a.difficulty] - RANK[b.difficulty] || a.number - b.number,
        solved: (a, b) => (b.solvedCount || 0) - (a.solvedCount || 0) || a.number - b.number,
    }[sort];

    const list = problems.filter(p =>
        (language === 'all' || p.languages.includes(language)) &&
        (difficulty === 'all' || p.difficulty === difficulty) &&
        (status === 'all' || (status === 'pending'
            ? p.published === false
            : !p.comingSoon && (status === 'solved') === p.solved)) &&
        (!query.trim() || !!p.title?.toLowerCase().includes(query.trim().toLowerCase())))
        .sort(compare);

    const pickRandom = () => {
        const open = list.filter(p => !p.comingSoon);
        const unsolved = open.filter(p => !p.solved);
        const pool = unsolved.length ? unsolved : open;
        if (pool.length) router.push(`/train/${pool[Math.floor(Math.random() * pool.length)]._id}`);
    };

    const SortHead = ({ id, children, className = '' }) => (
        <button onClick={() => setSort(id)}
            className={`items-center gap-1 uppercase tracking-wider hover:text-gray-300 ${sort === id ? 'text-gray-200' : ''} ${className}`}>
            {children} <ArrowUpDown size={11} />
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-950 p-[10px]">
            <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] gap-[10px] items-start">
                <div className="space-y-[10px] min-w-0">
                    {/* Til bo'yicha tezkor filtr */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {[['all', 'Barchasi'], ...Object.entries(LANGUAGES)].map(([key, label]) => (
                            <button key={key} onClick={() => setLanguage(key)}
                                className={`flex items-center gap-2 shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${language === key ? 'bg-white text-gray-900' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'}`}>
                                {label}
                                <span className="text-xs opacity-60">
                                    {key === 'all' ? count : problems.filter(p => p.languages.includes(key)).length}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                        {/* Asboblar qatori */}
                        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-800">
                            <div className="relative flex-1 min-w-[180px]">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Masala qidirish…"
                                    className={`${selectCls} w-full pl-9`} />
                            </div>
                            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className={selectCls}>
                                <option value="all">Qiyinlik</option>
                                {Object.entries(DIFFICULTY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
                                <option value="all">Holat</option>
                                <option value="solved">Yechilgan</option>
                                <option value="unsolved">Yechilmagan</option>
                                {(data.isAdmin || pending > 0) && <option value="pending">Tekshiruvda ({pending})</option>}
                            </select>
                            <button onClick={pickRandom} disabled={!list.length}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-sm text-gray-300 hover:text-white disabled:opacity-40">
                                <Shuffle size={14} className="text-green-400" /> Tasodifiy
                            </button>
                            {data.canCreate ? (
                                <Link href="/train/new" className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg">
                                    <Plus size={14} /> Masala qo&apos;shish
                                </Link>
                            ) : (
                                <span className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 text-gray-500 text-xs rounded-lg">
                                    <Lock size={12} /> Qo&apos;shish: Level {CREATE_LEVEL}
                                </span>
                            )}
                        </div>

                        <div className={`${ROW} py-2.5 border-b border-gray-800 text-[11px] font-semibold text-gray-500`}>
                            <span />
                            <SortHead id="number" className="flex">Masala</SortHead>
                            <span className="hidden md:block uppercase tracking-wider">Tillar</span>
                            <span className="hidden 2xl:block uppercase tracking-wider">Faollik</span>
                            <SortHead id="solved" className="hidden md:flex justify-end">Yechgan</SortHead>
                            <SortHead id="difficulty" className="flex justify-end">Daraja</SortHead>
                            <span className="hidden md:block text-right uppercase tracking-wider">XP</span>
                        </div>

                        {list.length === 0 ? (
                            <p className="text-center text-gray-500 py-16 text-sm">
                                {count === 0 ? "Hozircha masalalar yo'q" : 'Mos masala topilmadi'}
                            </p>
                        ) : list.map((p, i) => p.comingSoon ? (
                            <ComingSoonRow key={p._id} p={p} striped={i % 2 === 1} />
                        ) : (
                            <Link key={p._id} href={`/train/${p._id}`}
                                className={`${ROW} py-3 hover:bg-gray-800 transition-colors ${i % 2 ? 'bg-gray-800/40' : ''}`}>
                                <span title={p.solved ? 'Yechilgan' : undefined}>
                                    {p.solved && <CircleCheck size={16} className="text-teal-400" />}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm text-gray-100 truncate">{p.number}. {p.title}</p>
                                    <p className="text-[11px] text-gray-600 truncate">
                                        {!p.published && <span className="mr-2 font-semibold text-yellow-400">Tekshiruvda</span>}
                                        {p.author}
                                    </p>
                                    <Engagement p={p} className="flex 2xl:hidden mt-1" />
                                </div>
                                <div className="hidden md:flex gap-1 overflow-hidden">
                                    {p.languages.map(l => (
                                        <span key={l} className="px-2 py-0.5 rounded-full bg-gray-800 text-[11px] text-gray-400">{LANGUAGES[l]}</span>
                                    ))}
                                </div>
                                <Engagement p={p} className="hidden 2xl:flex" />
                                <span className="hidden md:block text-right text-xs text-gray-400">{p.solvedCount}</span>
                                <span className={`text-right text-xs font-semibold ${TEXT[p.difficulty]}`}>{DIFFICULTY[p.difficulty].label}</span>
                                <span className="hidden md:block text-right text-xs text-gray-500">+{DIFFICULTY[p.difficulty].xp}</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* O'ng panel: shaxsiy natija. Tor ekranda ro'yxatdan tepada turadi */}
                <aside className="order-first xl:order-none xl:sticky xl:top-[74px] space-y-[10px]">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
                    <p className="text-sm font-semibold text-white">Mening natijam</p>
                    <div className="flex flex-wrap xl:flex-col items-center gap-5">
                        <ProgressRing stats={stats} solved={solvedCount} total={total} />
                        <div className="flex-1 min-w-[180px] w-full space-y-3">
                            {stats.map(s => (
                                <div key={s.key}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className={`font-semibold ${TEXT[s.key]}`}>{DIFFICULTY[s.key].label}</span>
                                        <span className="text-gray-400">{s.solved}/{s.total}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                                        <div className={`h-full rounded-full ${BAR[s.key]}`} style={{ width: `${s.total ? (s.solved / s.total) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-800 pt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5"><Users size={13} /> Level {data.level}</span>
                        <span><span className="text-green-400 font-semibold">{earned} XP</span> lik masala yechilgan</span>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">Kunlik statistika</p>
                        <span className="flex items-center gap-1 text-xs text-gray-400" title="Ketma-ket masala yechilgan kunlar">
                            <Flame size={13} className="text-orange-400" /> {solveStreaks(data.daily.solves).current} kun
                        </span>
                    </div>
                    <TrainDailyChart series={dailySeries(data.daily.solves, data.daily.submissions, 14)} />
                    <Link href="/user" className="block text-center text-xs text-green-400 hover:text-green-300 border-t border-gray-800 pt-3">
                        To&apos;liq statistika →
                    </Link>
                </div>
                </aside>
            </div>
        </div>
    );
}

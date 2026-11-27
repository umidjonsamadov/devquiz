'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    List, ChevronLeft, ChevronRight, CloudUpload, Trash2, Loader2, CircleCheck, FileText,
    ClipboardCheck, MessageSquare, ThumbsUp, ThumbsDown, Eye, Play, Users, Lock, Zap,
} from 'lucide-react';
import TrainEditor from '../../../components/trainEditor';
import TrainTestPanel from '../../../components/trainTestPanel';
import TrainLock from '../../../components/trainLock';
import TrainComments from '../../../components/trainComments';
import PublishBar from '../../../components/publishBar';
import { ComingSoonPage } from '../../../components/comingSoon';
import { runTests } from '../../../lib/codeRunner';
import useContentGuard from '../../../lib/useContentGuard';
import { DIFFICULTY, LANGUAGES, starterCode } from '../../../lib/train';

// Yozilgan kod sahifa yopilsa ham saqlanib qoladi (faqat shu brauzerda).
// Kalitda foydalanuvchi ID'si bor: bitta brauzerdagi boshqa akkaunt bu kodni ko'rmaydi
const draftKey = (userId, id, lang) => `train-draft:${userId}:${id}:${lang}`;
const readDraft = (...key) => { try { return localStorage.getItem(draftKey(...key)); } catch { return null; } };
const writeDraft = (userId, id, lang, code) => { try { localStorage.setItem(draftKey(userId, id, lang), code); } catch {} };

const iconBtn = 'p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function NavArrow({ to, title, children }) {
    return to
        ? <Link href={`/train/${to._id}`} title={title} className={iconBtn}>{children}</Link>
        : <span className="p-2 text-gray-700">{children}</span>;
}

// Panellar orasidagi sudraladigan chiziq. Pointer capture sababli Monaco hodisalarni "yutib" qo'ymaydi
function Splitter({ vertical, onDrag }) {
    return (
        <div
            onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) onDrag(e); }}
            title="O'lchamni o'zgartirish uchun suring"
            className={`hidden lg:flex shrink-0 items-center justify-center touch-none group ${vertical ? 'w-[10px] cursor-col-resize' : 'h-[10px] cursor-row-resize'}`}
        >
            <div className={`rounded-full bg-gray-700 group-hover:bg-green-500 group-active:bg-green-500 ${vertical ? 'w-[3px] h-10' : 'h-[3px] w-10'}`} />
        </div>
    );
}

export default function TrainProblemPage() {
    const { id } = useParams();
    const router = useRouter();
    const [data, setData] = useState(null);
    const [list, setList] = useState([]);       // oldingi/keyingi masala va tartib raqami uchun
    const [locked, setLocked] = useState(null);
    const [comingSoon, setComingSoon] = useState(false);
    const [error, setError] = useState('');
    const [language, setLanguage] = useState(null);
    const [codes, setCodes] = useState({});
    const [running, setRunning] = useState(false);
    const [runResult, setRunResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [verdict, setVerdict] = useState(null);
    const [tab, setTab] = useState('description'); // description | result | comments
    const [stats, setStats] = useState(null);       // views, likes, dislikes, comments, myReaction
    const [comments, setComments] = useState(null);
    const [commentsError, setCommentsError] = useState('');
    const [reacting, setReacting] = useState(false);
    const [leftWidth, setLeftWidth] = useState(42);    // chap panel kengligi, %
    const [editorHeight, setEditorHeight] = useState(62); // muharrir balandligi, %
    const [expanded, setExpanded] = useState(false);
    const splitRef = useRef(null);
    const rightRef = useRef(null);

    // canDelete — admin yoki muallif: ularga cheklov yo'q
    useContentGuard(!!data && !data.canDelete, () => ({ source: 'train', itemId: id }));

    useEffect(() => {
        fetch(`/api/train/problems/${id}`)
            .then(async (res) => {
                const d = await res.json();
                if (d.locked) return setLocked(d);
                if (d.comingSoon) return setComingSoon(true);
                if (!res.ok) return setError(d.message || 'Xatolik yuz berdi');
                const p = d.problem;
                const initial = {};
                for (const l of p.languages) {
                    initial[l] = readDraft(d.viewerId, id, l)
                        ?? (d.solve?.language === l ? d.solve.code : starterCode(l, p.functionName, p.params));
                }
                setCodes(initial);
                setLanguage(p.languages.includes(d.solve?.language) ? d.solve.language : p.languages[0]);
                setData(d);
                setStats(d.stats);
            })
            .catch(() => setError("Serverga ulanib bo'lmadi"));
        fetch(`/api/train/problems/${id}/comments`)
            .then(async (res) => {
                const d = await res.json();
                if (res.ok) setComments(d.comments);
                else setCommentsError(d.message || "Izohlarni yuklab bo'lmadi");
            })
            .catch(() => setCommentsError("Izohlarni yuklab bo'lmadi"));
        fetch('/api/train/problems')
            .then(res => res.json())
            .then(d => setList([...(d.problems || [])].reverse()))
            .catch(() => {});
    }, [id]);

    if (locked) return <TrainLock level={locked.level} xp={locked.xp} />;
    if (comingSoon) return <ComingSoonPage what="masala" backHref="/train" />;
    if (error) return (
        <div className="text-center py-20">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <Link href="/train" className="text-green-400 text-sm">← Masalalar ro&apos;yxati</Link>
        </div>
    );
    if (!data) return (
        <div className="flex items-center justify-center min-h-screen bg-gray-950">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    const { problem, canDelete } = data;
    const samples = problem.testCases.filter(t => !t.hidden);
    const solved = !!data.solve || (verdict?.accepted && !verdict.preview);
    const index = list.findIndex(p => p._id === id);
    // Oldingi/keyingi o'qlari "Coming soon" masalalarni o'tkazib yuboradi
    const previous = index > 0 ? list.slice(0, index).reverse().find(p => !p.comingSoon) : null;
    const next = index >= 0 ? list.slice(index + 1).find(p => !p.comingSoon) : null;
    const busy = running || submitting;

    const changeCode = (v) => {
        setCodes(c => ({ ...c, [language]: v }));
        writeDraft(data.viewerId, id, language, v);
    };

    const changeLanguage = (l) => {
        setLanguage(l);
        setRunResult(null);
        setVerdict(null);
    };

    const resetCode = () => {
        if (window.confirm("Kodni boshlang'ich holatga qaytarasizmi?")) {
            changeCode(starterCode(language, problem.functionName, problem.params));
            setRunResult(null);
        }
    };

    // Run: faqat namuna testlar, natija saqlanmaydi
    const run = async () => {
        if (busy) return;
        setRunning(true);
        setRunResult(null);
        setExpanded(false);
        try {
            setRunResult(await runTests({
                language, code: codes[language] || '', functionName: problem.functionName, testCases: samples,
            }));
        } catch (e) {
            setRunResult({ passed: 0, total: samples.length, results: [], error: String(e?.message || e) });
        } finally {
            setRunning(false);
        }
    };

    // Yuborish: ochiq va yashirin testlar, yakuniy javobni server beradi
    const submit = async () => {
        if (busy) return;
        const code = codes[language] || '';
        setSubmitting(true);
        setVerdict(null);
        setTab('result');
        try {
            const attempt = await runTests({ language, code, functionName: problem.functionName, testCases: problem.testCases });
            if (attempt.error) { setVerdict({ message: attempt.error }); return; }
            const res = await fetch(`/api/train/problems/${id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language, code, outputs: attempt.results.map(r => r.got ?? null) }),
            });
            const d = await res.json();
            if (!res.ok) { setVerdict({ message: d.message || 'Xatolik yuz berdi' }); return; }
            // Birinchi o'tmagan testning natijasini ko'rsatish uchun saqlaymiz
            const failed = d.failedTest ? d.failedTest - 1 : -1;
            setVerdict({ ...d, failed: failed >= 0 ? { ...problem.testCases[failed], got: attempt.results[failed]?.got } : null });
            if (d.xp) window.dispatchEvent(new Event('user-updated'));
        } catch {
            setVerdict({ message: "Yuborib bo'lmadi, qayta urinib ko'ring" });
        } finally {
            setSubmitting(false);
        }
    };

    const remove = async () => {
        if (!window.confirm("Masalani o'chirasizmi?")) return;
        const res = await fetch(`/api/train/problems/${id}`, { method: 'DELETE' });
        if (res.ok) router.push('/train');
        else { setVerdict({ message: "O'chirib bo'lmadi" }); setTab('result'); }
    };

    // Bosilgan tugma qayta bosilsa, baho olib tashlanadi
    const react = async (value) => {
        if (reacting) return;
        setReacting(true);
        const reaction = stats.myReaction === value ? null : value;
        const res = await fetch(`/api/train/problems/${id}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction }),
        }).catch(() => null);
        if (res?.ok) {
            const d = await res.json();
            setStats(s => ({ ...s, ...d }));
        }
        setReacting(false);
    };

    const publish = async (published) => {
        const res = await fetch(`/api/train/problems/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ published }),
        }).catch(() => null);
        if (!res?.ok) return (await res?.json().catch(() => null))?.message || "Saqlab bo'lmadi";
        setData(d => ({ ...d, problem: { ...d.problem, published } }));
        setVerdict(null);
    };

    const commentCount = comments?.length ?? stats.comments;
    const reactionCls = (value, activeCls) =>
        `flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-gray-700 disabled:opacity-60 ${stats.myReaction === value ? activeCls : 'text-gray-400'}`;

    const dragColumns = (e) => {
        const rect = splitRef.current.getBoundingClientRect();
        setLeftWidth(clamp(((e.clientX - rect.left) / rect.width) * 100, 25, 65));
    };
    const dragRows = (e) => {
        const rect = rightRef.current.getBoundingClientRect();
        setEditorHeight(clamp(((e.clientY - rect.top) / rect.height) * 100, 30, 80));
    };

    const tabs = [
        { key: 'description', label: 'Shart', icon: FileText },
        { key: 'result', label: 'Natija', icon: ClipboardCheck },
        { key: 'comments', label: `Izohlar (${commentCount})`, icon: MessageSquare },
    ];

    return (
        // 64px — sayt header'ining balandligi; keng ekranda sahifa aylanmaydi, faqat panellar
        <div data-guard-zone className="bg-gray-950 p-[10px] flex flex-col gap-[10px] lg:h-[calc(100vh-64px)] lg:min-h-[560px]">
            {/* Yuqori qator */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 min-w-0">
                    <Link href="/train" className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-800">
                        <List size={16} /> <span className="hidden md:inline">Masalalar</span>
                    </Link>
                    <NavArrow to={previous} title="Oldingi masala"><ChevronLeft size={16} /></NavArrow>
                    <NavArrow to={next} title="Keyingi masala"><ChevronRight size={16} /></NavArrow>
                </div>

                <div className="flex items-center gap-[2px] rounded-lg overflow-hidden">
                    <button onClick={run} disabled={busy} title="Namuna testlarda tekshirish (Ctrl+Enter)"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-gray-200 text-sm font-semibold">
                        {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />} Run
                    </button>
                    <button onClick={submit} disabled={busy} title="Barcha testlarda tekshirib yuborish"
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm font-bold">
                        {submitting ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={15} />}
                        {submitting ? 'Tekshirilmoqda…' : 'Yuborish'}
                    </button>
                </div>

                <div className="flex items-center justify-end">
                    {canDelete && (
                        <button onClick={remove} title="Masalani o'chirish" className={`${iconBtn} hover:text-red-400`}><Trash2 size={16} /></button>
                    )}
                </div>
            </div>

            {(data.isAdmin || !problem.published) && (
                <div className="shrink-0">
                    <PublishBar what="masala" published={problem.published} onChange={data.isAdmin ? publish : null} />
                </div>
            )}

            <div ref={splitRef} className="flex-1 min-h-0 flex flex-col lg:flex-row gap-[10px] lg:gap-0"
                style={{ '--left': `${leftWidth}%`, '--top': `${editorHeight}%` }}>
                {/* Chap panel: shart, natija, izohlar */}
                <section className={`flex flex-col min-h-0 min-w-0 lg:w-[var(--left)] lg:shrink-0 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden ${expanded ? 'lg:hidden' : ''}`}>
                    <div className="h-10 shrink-0 flex items-center gap-1 px-2 bg-gray-800/60 border-b border-gray-800 overflow-x-auto no-scrollbar">
                        {tabs.map(({ key, label, icon: Icon }) => (
                            <button key={key} onClick={() => setTab(key)}
                                className={`flex items-center gap-1.5 h-full shrink-0 px-3 text-xs font-semibold border-b-2 ${tab === key ? 'border-green-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                                <Icon size={13} className={tab === key ? 'text-green-400' : ''} /> {label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto p-5">
                        {tab === 'description' ? (
                            <div className="space-y-6">
                                <header>
                                    <h1 className="text-2xl font-bold text-white leading-snug break-words">
                                        {index >= 0 ? `${index + 1}. ` : ''}{problem.title}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-2 mt-3">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${DIFFICULTY[problem.difficulty].cls}`}>
                                            {DIFFICULTY[problem.difficulty].label}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-300">
                                            <Zap size={11} className="text-yellow-400" /> {DIFFICULTY[problem.difficulty].xp} XP
                                        </span>
                                        {solved && (
                                            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-teal-900/30 text-teal-300">
                                                <CircleCheck size={12} /> Yechilgan
                                            </span>
                                        )}
                                    </div>
                                </header>

                                <p className="text-[15px] text-gray-300 leading-7 whitespace-pre-wrap break-words">{problem.description}</p>

                                <div className="space-y-4">
                                    {samples.map((t, i) => (
                                        <div key={i}>
                                            <p className="text-sm font-bold text-white mb-2">{i + 1}-misol</p>
                                            <div className="rounded-xl bg-gray-800/60 border border-gray-800 p-3.5 font-mono text-[13px] leading-6 whitespace-pre-wrap break-words space-y-1">
                                                <p className="text-gray-300">
                                                    <span className="text-gray-500">Kirish: </span>
                                                    {t.args.map((a, j) => `${problem.params[j]} = ${JSON.stringify(a)}`).join(', ') || '—'}
                                                </p>
                                                <p className="text-gray-300"><span className="text-gray-500">Chiqish: </span>{JSON.stringify(t.expected)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {data.review && !problem.published && (
                                    <div className="rounded-xl border border-yellow-800/60 bg-yellow-900/10 p-3.5">
                                        <p className="text-sm font-bold text-yellow-300 mb-2">Admin tekshiruvi: barcha testlar ({data.review.length})</p>
                                        <div className="space-y-1.5 font-mono text-xs text-gray-300">
                                            {data.review.map((t, i) => (
                                                <p key={i} className="rounded-lg bg-gray-800/70 px-2.5 py-1.5 whitespace-pre-wrap break-words">
                                                    <span className={t.hidden ? 'text-purple-300' : 'text-gray-500'}>{i + 1}. {t.hidden ? 'yashirin' : 'ochiq'}: </span>
                                                    {JSON.stringify(t.args)} → <span className="text-green-300">{JSON.stringify(t.expected)}</span>
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 text-center">
                                    {[
                                        [Users, 'Yechganlar', problem.solvedCount],
                                        [Lock, 'Yashirin test', problem.testCases.length - samples.length],
                                        [Eye, "Ko'rganlar", stats.views],
                                    ].map(([Icon, label, value]) => (
                                        <div key={label} className="rounded-xl border border-gray-800 py-2.5">
                                            <p className="text-base font-bold text-white">{value}</p>
                                            <p className="flex items-center justify-center gap-1 text-[11px] text-gray-500"><Icon size={11} /> {label}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500">Muallif: <span className="text-gray-300">{problem.author}</span></p>
                            </div>
                        ) : tab === 'comments' ? (
                            <TrainComments problemId={id} comments={comments} loadError={commentsError} onChange={setComments} />
                        ) : submitting ? (
                            <div className="flex flex-col items-center gap-3 py-16 text-sm text-gray-400">
                                <Loader2 size={24} className="animate-spin text-green-400" /> Barcha testlar tekshirilmoqda…
                            </div>
                        ) : !verdict ? (
                            <p className="text-center text-sm text-gray-500 py-16">Yechimni yuboring — natija shu yerda chiqadi.</p>
                        ) : verdict.message ? (
                            <div>
                                <p className="text-lg font-bold text-red-400 mb-3">Xatolik</p>
                                <pre className="rounded-lg bg-red-900/20 border border-red-900 p-3 text-xs text-red-300 whitespace-pre-wrap break-words">{verdict.message}</pre>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className={`rounded-xl border p-4 ${verdict.accepted ? 'bg-teal-900/20 border-teal-900' : 'bg-red-900/20 border-red-900'}`}>
                                    <p className={`text-xl font-bold ${verdict.accepted ? 'text-teal-400' : 'text-red-400'}`}>
                                        {verdict.accepted ? 'Qabul qilindi' : "Noto'g'ri javob"}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">{verdict.passed}/{verdict.total} test o&apos;tdi</p>
                                    <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden mt-3">
                                        <div className={`h-full ${verdict.accepted ? 'bg-teal-400' : 'bg-red-500'}`} style={{ width: `${(verdict.passed / verdict.total) * 100}%` }} />
                                    </div>
                                </div>
                                {verdict.preview && (
                                    <p className="rounded-lg bg-yellow-900/20 border border-yellow-900 p-3 text-xs text-yellow-200">
                                        Tekshiruv rejimi: masala hali nashr qilinmagan, natija va XP saqlanmadi.
                                    </p>
                                )}
                                {verdict.xp > 0 && (
                                    <p className="rounded-lg bg-green-900/20 border border-green-900 p-3 text-sm text-green-300">+{verdict.xp} XP qo&apos;lga kiritdingiz!{verdict.xpMultiplier > 1 && ` (1-o'rin bonusi: ${verdict.xpMultiplier}x)`}</p>
                                )}
                                {verdict.failed && (verdict.failed.hidden ? (
                                    <p className="text-sm text-gray-400">{verdict.failedTest}-test (yashirin) o&apos;tmadi.</p>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-sm text-gray-400">{verdict.failedTest}-test o&apos;tmadi:</p>
                                        {[
                                            ['Kirish', verdict.failed.args.map((a, j) => `${problem.params[j]} = ${JSON.stringify(a)}`).join('\n') || '—'],
                                            ['Sizning javobingiz', verdict.failed.got ?? 'undefined'],
                                            ['Kutilgan javob', JSON.stringify(verdict.failed.expected)],
                                        ].map(([label, value]) => (
                                            <div key={label}>
                                                <p className="text-xs text-gray-500 mb-1">{label}</p>
                                                <pre className="rounded-lg bg-gray-800 p-3 font-mono text-xs text-gray-200 whitespace-pre-wrap break-words">{value}</pre>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                <p className="text-xs text-gray-600">Til: {LANGUAGES[language]}</p>
                            </div>
                        )}
                    </div>

                    {/* Pastki qator: baho, izohlar, ko'rishlar */}
                    <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-gray-800">
                        <div className="flex rounded-lg bg-gray-800 overflow-hidden divide-x divide-gray-700">
                            <button onClick={() => react('like')} disabled={reacting} title="Yoqdi" aria-pressed={stats.myReaction === 'like'}
                                className={reactionCls('like', 'text-green-400')}>
                                <ThumbsUp size={14} fill={stats.myReaction === 'like' ? 'currentColor' : 'none'} /> {stats.likes}
                            </button>
                            <button onClick={() => react('dislike')} disabled={reacting} title="Yoqmadi" aria-pressed={stats.myReaction === 'dislike'}
                                className={reactionCls('dislike', 'text-red-400')}>
                                <ThumbsDown size={14} fill={stats.myReaction === 'dislike' ? 'currentColor' : 'none'} /> {stats.dislikes}
                            </button>
                        </div>
                        <button onClick={() => setTab('comments')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800">
                            <MessageSquare size={14} /> {commentCount}
                        </button>
                        <span className="ml-auto flex items-center gap-1.5 text-xs text-gray-500" title="Masalani ko'rgan odamlar soni">
                            <Eye size={14} /> {stats.views}
                        </span>
                    </div>
                </section>

                {!expanded && <Splitter vertical onDrag={dragColumns} />}

                {/* O'ng panel: muharrir va testlar */}
                <div ref={rightRef} className="flex-1 min-w-0 min-h-0 flex flex-col gap-[10px] lg:gap-0">
                    <div className={`h-[60vh] min-h-[360px] lg:min-h-0 ${expanded ? 'lg:h-full' : 'lg:h-[var(--top)]'}`}>
                        <TrainEditor
                            key={language}
                            language={language}
                            languages={problem.languages}
                            onLanguage={changeLanguage}
                            value={codes[language] ?? ''}
                            onChange={changeCode}
                            onReset={resetCode}
                            onRun={run}
                            disabled={busy}
                            expanded={expanded}
                            onExpand={() => setExpanded(v => !v)}
                        />
                    </div>
                    {!expanded && <Splitter onDrag={dragRows} />}
                    <div className={`h-[360px] lg:h-auto lg:flex-1 lg:min-h-0 ${expanded ? 'lg:hidden' : ''}`}>
                        <TrainTestPanel samples={samples} params={problem.params} running={running} result={runResult} />
                    </div>
                </div>
            </div>
        </div>
    );
}

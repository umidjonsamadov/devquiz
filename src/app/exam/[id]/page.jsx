"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import {
    Clock, ShieldAlert, Maximize, CheckCircle2, XCircle, Play, ChevronLeft, ChevronRight,
    Code2, ListChecks, Trophy, AlertTriangle, Loader2, Send, Flag,
} from 'lucide-react';
import { preloadPython } from '../../../lib/codeRunner';
import CodeIDE from '../../../components/CodeIDE';
import ExamResultSummary from '../../../components/ExamResultSummary';

const MAX_VIOLATIONS = 3;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const fmt = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
};

export default function ExamTakePage() {
    const { id } = useParams();
    const router = useRouter();

    const [phase, setPhase] = useState('loading'); // loading | intro | running | done | error
    const [error, setError] = useState('');
    const [exam, setExam] = useState(null);
    const [username, setUsername] = useState('');
    const [idx, setIdx] = useState(0);
    const [answers, setAnswers] = useState({});   // { qid: optionIndex }
    const [codes, setCodes] = useState({});       // { qid: string }
    const [remaining, setRemaining] = useState(0);
    const [violations, setViolations] = useState(0);
    const [locked, setLocked] = useState(null);   // null | sabab matni
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [term, setTerm] = useState({});         // { qid: terminal satrlari }
    const clipRef = useRef('');                   // IDE ichidan nusxalangan matn
    const [flags, setFlags] = useState({});       // { qid: true } keyin qaytish uchun belgilanganlar
    const [autoMove, setAutoMove] = useState(false); // testlar tugadi -> amaliyga o'tish bildirishi
    const autoTimerRef = useRef(null);
    const testsDoneRef = useRef(false);

    // Eng so'nggi qiymatlar (event listener va finish ichida kerak)
    const dataRef = useRef({});
    dataRef.current = { exam, answers, codes };
    const endAtRef = useRef(0);
    const violationsRef = useRef(0);
    const lockedRef = useRef(false);
    const finishedRef = useRef(false);
    const phaseRef = useRef('loading');
    phaseRef.current = phase;

    // ── Yuklash ───────────────────────────────────────────────
    useEffect(() => {
        try {
            const raw = Cookies.get('session_token');
            if (!raw) { router.push('/login'); return; }
            setUsername(JSON.parse(raw).username || '');
        } catch { router.push('/login'); return; }

        (async () => {
            try {
                const r = await fetch(`/api/exams/${id}`);
                const d = await r.json();
                if (!r.ok) { setError(d.message || 'Xato'); setPhase('error'); return; }
                const a = await fetch(`/api/exams/${id}/attempt`).then(x => x.json());
                if (a.attempt?.status === 'finished') {
                    setResult(a.attempt);
                    setPhase('done');
                } else {
                    setPhase('intro');
                }
                setExam(d.exam);
                const init = {};
                d.exam.questions.forEach(q => { if (q.type === 'code') init[q._id] = q.starterCode || ''; });
                setCodes(init);
            } catch { setError('Internet xatosi'); setPhase('error'); }
        })();
    }, [id, router]);

    // ── Yakunlash ─────────────────────────────────────────────
    const finish = useCallback(async (reason = 'submitted') => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        setSubmitting(true);
        setConfirmEnd(false);

        const { exam: ex, answers: ans, codes: cds } = dataRef.current;
        const code = {};
        for (const q of ex.questions) {
            if (q.type === 'code') code[q._id] = { code: cds[q._id] || '' };
        }

        try {
            if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
            const r = await fetch(`/api/exams/${id}/attempt`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: ans, code, violations: violationsRef.current, reason }),
            });
            const d = await r.json();
            setResult(d.attempt || null);
        } catch {
            setResult(null);
        }
        setLocked(null);
        setSubmitting(false);
        setPhase('done');
    }, [id]);

    // ── Qoidabuzarlik ─────────────────────────────────────────
    const lock = useCallback((reason) => {
        if (finishedRef.current || phaseRef.current !== 'running' || lockedRef.current) return;
        lockedRef.current = true;
        setLocked(reason);
        violationsRef.current += 1;
        setViolations(violationsRef.current);
        fetch(`/api/exams/${id}/attempt`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ violations: violationsRef.current }),
            keepalive: true,
        }).catch(() => {});
        if (violationsRef.current >= MAX_VIOLATIONS) finish('violations');
    }, [id, finish]);

    const resume = async () => {
        try { await document.documentElement.requestFullscreen(); } catch {}
        if (document.fullscreenElement) {
            lockedRef.current = false;
            setLocked(null);
        }
    };

    // ── Boshlash ──────────────────────────────────────────────
    const start = async () => {
        try { await document.documentElement.requestFullscreen(); } catch {}
        if (!document.fullscreenElement) {
            setError("To'liq ekran rejimiga o'tib bo'lmadi. Brauzer ruxsatini tekshiring.");
            return;
        }
        try {
            const r = await fetch(`/api/exams/${id}/attempt`, { method: 'POST' });
            const d = await r.json();
            if (!r.ok) {
                await document.exitFullscreen().catch(() => {});
                setError(d.message || 'Xato');
                return;
            }
            setError('');
            violationsRef.current = d.attempt.violations || 0;
            setViolations(violationsRef.current);
            endAtRef.current = Date.now() + d.attempt.remainingMs;
            setRemaining(d.attempt.remainingMs);
            lockedRef.current = false;
            if (exam.questions.some(x => x.type === 'code' && x.language === 'python')) preloadPython().catch(() => {});
            setPhase('running');
            if (violationsRef.current >= MAX_VIOLATIONS) finish('violations');
        } catch {
            await document.exitFullscreen().catch(() => {});
            setError('Internet xatosi');
        }
    };

    // ── Taymer ────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'running') return;
        const t = setInterval(() => {
            const left = endAtRef.current - Date.now();
            setRemaining(left);
            if (left <= 0) finish('time');
        }, 500);
        return () => clearInterval(t);
    }, [phase, finish]);

    // ── Himoya listenerlari ───────────────────────────────────
    useEffect(() => {
        if (phase !== 'running') return;

        const onFs = () => { if (!document.fullscreenElement) lock("To'liq ekrandan chiqdingiz"); };
        const onVis = () => { if (document.hidden) lock("Boshqa oyna yoki tabga o'tdingiz"); };
        const onBlur = () => lock("Imtihon oynasidan chiqdingiz");
        const block = (e) => e.preventDefault();
        const inIde = (e) => !!e.target?.closest?.('[data-ide]');
        // IDE ichida nusxalash/qirqish mumkin (kodni ko'chirish uchun), tashqarida yo'q
        const onCopy = (e) => {
            if (!inIde(e)) { e.preventDefault(); return; }
            try { clipRef.current = e.clipboardData.getData('text/plain'); } catch {}
        };
        // Qo'yish faqat IDE ichidan nusxalangan matn bo'lsa mumkin: tashqaridan kod kiritib bo'lmaydi
        const onPaste = (e) => {
            let txt = '';
            try { txt = e.clipboardData.getData('text/plain'); } catch {}
            if (inIde(e) && txt && txt === clipRef.current) return;
            e.preventDefault(); e.stopPropagation();
        };
        const onKeyDown = (e) => {
            const k = e.key;
            if (k === 'PrintScreen' || (e.metaKey && e.shiftKey) || (e.ctrlKey && e.shiftKey && /s/i.test(k))) {
                navigator.clipboard?.writeText('').catch(() => {});
                lock('Skrinshot urinishi aniqlandi');
                e.preventDefault();
            }
            if (k === 'F12' || (e.ctrlKey && /^[pspu]$/i.test(k)) || (e.ctrlKey && e.shiftKey && /^[ij]$/i.test(k))) e.preventDefault();
        };
        const onKeyUp = (e) => {
            if (e.key === 'PrintScreen') {
                navigator.clipboard?.writeText('').catch(() => {});
                lock('Skrinshot urinishi aniqlandi');
            }
        };
        const onUnload = (e) => { e.preventDefault(); e.returnValue = ''; };

        document.addEventListener('fullscreenchange', onFs);
        document.addEventListener('visibilitychange', onVis);
        window.addEventListener('blur', onBlur);
        document.addEventListener('contextmenu', block);
        document.addEventListener('copy', onCopy);
        document.addEventListener('cut', onCopy);
        document.addEventListener('paste', onPaste, true);
        document.addEventListener('dragstart', block);
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp, true);
        window.addEventListener('beforeunload', onUnload);
        return () => {
            document.removeEventListener('fullscreenchange', onFs);
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('blur', onBlur);
            document.removeEventListener('contextmenu', block);
            document.removeEventListener('copy', onCopy);
            document.removeEventListener('cut', onCopy);
            document.removeEventListener('paste', onPaste, true);
            document.removeEventListener('dragstart', block);
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('keyup', onKeyUp, true);
            window.removeEventListener('beforeunload', onUnload);
        };
    }, [phase, lock]);

    // ── Testlar tugagach avtomatik amaliy bo'limga o'tish ─────
    const testsDone = !!exam && exam.questions.some(x => x.type === 'test')
        && exam.questions.filter(x => x.type === 'test').every(x => answers[x._id] !== undefined);

    useEffect(() => {
        if (phase !== 'running') { testsDoneRef.current = testsDone; return; }
        const justFinished = testsDone && !testsDoneRef.current;
        testsDoneRef.current = testsDone;
        if (!justFinished) return;
        const firstCode = exam.questions.findIndex(x => x.type === 'code');
        if (firstCode < 0) return;
        setAutoMove(true);
        autoTimerRef.current = setTimeout(() => {
            setAutoMove(false);
            setIdx(firstCode);
        }, 2000);
    }, [testsDone, phase, exam]);

    useEffect(() => () => clearTimeout(autoTimerRef.current), []);

    const cancelAutoMove = () => { clearTimeout(autoTimerRef.current); setAutoMove(false); };

    // ── Klaviatura: A–F variant tanlash, ← → savollar orasida ──
    useEffect(() => {
        if (phase !== 'running' || locked || !exam) return;
        const onKey = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.target?.closest?.('[data-ide], input, textarea, select')) return;
            const cur = exam.questions[idx];
            if (!cur) return;
            const items = exam.questions.map((x, i) => ({ x, i })).filter(o => o.x.type === cur.type);
            const pos = items.findIndex(o => o.i === idx);
            if (e.key === 'ArrowRight' && pos < items.length - 1) { setIdx(items[pos + 1].i); e.preventDefault(); }
            else if (e.key === 'ArrowLeft' && pos > 0) { setIdx(items[pos - 1].i); e.preventDefault(); }
            else if (cur.type === 'test') {
                const n = LETTERS.indexOf(e.key.toUpperCase());
                if (n >= 0 && n < cur.options.length) { setAnswers(a => ({ ...a, [cur._id]: n })); e.preventDefault(); }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [phase, locked, exam, idx]);

    const setTermFor = (qid) => (upd) => setTerm(t => ({ ...t, [qid]: typeof upd === 'function' ? upd(t[qid] || []) : upd }));

    // ════════════════════ RENDER ═════════════════════════════
    const shell = 'fixed inset-0 z-[100] bg-gray-950 overflow-y-auto';

    if (phase === 'loading') {
        return <div className={`${shell} flex items-center justify-center`}><Loader2 className="animate-spin text-green-400" /></div>;
    }
    if (phase === 'error') {
        return (
            <div className={`${shell} flex flex-col items-center justify-center gap-3`}>
                <p className="text-red-400">{error}</p>
                <button onClick={() => router.push('/exam')} className="text-green-400 text-sm hover:underline">Imtihonlar ro&apos;yxatiga</button>
            </div>
        );
    }

    if (phase === 'done') {
        return (
            <div className={`${shell} flex items-start sm:items-center justify-center p-4`}>
                {result && exam ? (
                    <ExamResultSummary exam={exam} attempt={result} onBack={() => router.push('/exam')} />
                ) : (
                    <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                        <Trophy className="mx-auto text-green-400 mb-3" size={36} />
                        <h1 className="text-xl font-bold text-white mb-3">{exam?.title}</h1>
                        <p className="text-yellow-400 text-sm">Natijani yuklab bo&apos;lmadi. Administrator bilan bog&apos;laning.</p>
                        <button onClick={() => router.push('/exam')} className="mt-6 w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl text-sm">
                            Imtihonlarga qaytish
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (phase === 'intro') {
        const codeCount = exam.questions.filter(q => q.type === 'code').length;
        const total = exam.questions.reduce((s, q) => s + q.points, 0);
        return (
            <div className={`${shell} flex items-center justify-center p-4`}>
                <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl p-7">
                    <h1 className="text-2xl font-extrabold text-white mb-1">{exam.title}</h1>
                    {exam.description && <p className="text-gray-400 text-sm mb-4">{exam.description}</p>}
                    <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                        <div className="bg-gray-800/60 rounded-xl p-3"><Clock className="mx-auto text-blue-400 mb-1" size={16} /><p className="text-white font-bold">{exam.durationMinutes}</p><p className="text-[11px] text-gray-500">daqiqa</p></div>
                        <div className="bg-gray-800/60 rounded-xl p-3"><ListChecks className="mx-auto text-green-400 mb-1" size={16} /><p className="text-white font-bold">{exam.questions.length - codeCount}</p><p className="text-[11px] text-gray-500">test</p></div>
                        <div className="bg-gray-800/60 rounded-xl p-3"><Code2 className="mx-auto text-purple-400 mb-1" size={16} /><p className="text-white font-bold">{codeCount}</p><p className="text-[11px] text-gray-500">amaliy</p></div>
                    </div>
                    <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-4 text-xs text-yellow-200/90 space-y-1.5 mb-5">
                        <p className="flex items-center gap-1.5 font-semibold text-yellow-400"><ShieldAlert size={14} /> Qoidalar</p>
                        <p>• Imtihon to&apos;liq ekran rejimida o&apos;tadi. Jami {total} ball.</p>
                        <p>• Ekrandan chiqsangiz, boshqa oynaga o&apos;tsangiz yoki skrinshot olsangiz, savollar yashiriladi va qoidabuzarlik yoziladi.</p>
                        <p>• {MAX_VIOLATIONS} ta qoidabuzarlikdan keyin imtihon avtomatik tugaydi.</p>
                        <p>• Tashqaridan nusxa qo&apos;yish o&apos;chirilgan (kod muharriri ichida nusxalash mumkin). Vaqt tugasa javoblar avtomatik yuboriladi.</p>
                        <p>• Imtihonni faqat bir marta topshirish mumkin.</p>
                    </div>
                    {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                    <button onClick={start} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl">
                        <Maximize size={16} /> Testni boshlash
                    </button>
                    <button onClick={() => router.push('/exam')} className="w-full text-gray-500 hover:text-white text-sm mt-3">Orqaga</button>
                </div>
            </div>
        );
    }

    // ── running ───────────────────────────────────────────────
    const q = exam.questions[idx];
    const isCode = q.type === 'code';
    const isDone = (x) => x.type === 'test'
        ? answers[x._id] !== undefined
        : !!(codes[x._id] || '').trim() && codes[x._id] !== x.starterCode;
    const answeredCount = exam.questions.filter(isDone).length;
    const lowTime = remaining < 60000;

    // Bo'limlar: Test va Practical (amaliy bo'limda faqat kod savollari)
    const indexed = exam.questions.map((x, i) => ({ x, i }));
    const testItems = indexed.filter(o => o.x.type === 'test');
    const codeItems = indexed.filter(o => o.x.type === 'code');
    const sectionItems = isCode ? codeItems : testItems;
    const posInSection = sectionItems.findIndex(o => o.i === idx);
    const goSection = (items) => { cancelAutoMove(); if (items.length) setIdx(items[0].i); };
    const testDoneCount = testItems.filter(o => isDone(o.x)).length;
    const codeDoneCount = codeItems.filter(o => isDone(o.x)).length;
    const progressPct = exam.questions.length ? (answeredCount / exam.questions.length) * 100 : 0;
    const flaggedCount = Object.values(flags).filter(Boolean).length;

    // Yashirin holat: savollar umuman DOM'da yo'q
    if (locked) {
        const last = violations >= MAX_VIOLATIONS;
        return (
            <div className={`${shell} flex items-center justify-center p-4 select-none`}>
                <div className="w-full max-w-md text-center">
                    <ShieldAlert className="mx-auto text-red-400 mb-4" size={48} />
                    <h1 className="text-2xl font-extrabold text-white mb-2">Savollar yashirildi</h1>
                    <p className="text-red-300 text-sm mb-1">{locked}</p>
                    <p className="text-gray-400 text-sm mb-6">
                        Qoidabuzarlik: <b className="text-white">{violations}</b> / {MAX_VIOLATIONS}.
                        {violations === MAX_VIOLATIONS - 1 && ' Keyingisida imtihon tugaydi!'}
                    </p>
                    {last ? (
                        <p className="text-gray-400 text-sm flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={14} /> Imtihon yakunlanmoqda…</p>
                    ) : (
                        <button onClick={resume} className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-3 rounded-xl">
                            <Maximize size={16} /> Imtihonni davom ettirish
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const isLastInSection = posInSection >= sectionItems.length - 1;
    const toPractical = !isCode && isLastInSection && codeItems.length > 0;
    const navButtons = (
        <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-gray-800">
            <button onClick={() => { cancelAutoMove(); setIdx(sectionItems[posInSection - 1].i); }} disabled={posInSection <= 0}
                className="flex items-center gap-1 text-sm text-gray-300 disabled:opacity-30 hover:text-white"><ChevronLeft size={16} /> Oldingi</button>
            <span className="text-xs text-gray-500 tabular-nums">{posInSection + 1} / {sectionItems.length}</span>
            {toPractical ? (
                <button onClick={() => goSection(codeItems)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-purple-200 bg-purple-900/40 border border-purple-700 hover:bg-purple-800/50 px-3 py-1.5 rounded-lg">
                    Amaliyga o&apos;tish <ChevronRight size={16} />
                </button>
            ) : isLastInSection ? (
                <button onClick={() => setConfirmEnd(true)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg">
                    <Send size={13} /> Yakunlash
                </button>
            ) : (
                <button onClick={() => { cancelAutoMove(); setIdx(sectionItems[posInSection + 1].i); }}
                    className="flex items-center gap-1 text-sm text-gray-300 hover:text-white">Keyingi <ChevronRight size={16} /></button>
            )}
        </div>
    );

    const flagBtn = (
        <button onClick={() => setFlags(f => ({ ...f, [q._id]: !f[q._id] }))}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border ${flags[q._id] ? 'border-amber-600 bg-amber-900/30 text-amber-300' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}>
            <Flag size={11} /> {flags[q._id] ? 'Belgilangan' : 'Belgilash'}
        </button>
    );

    return (
        <div className={`${shell} select-none flex flex-col`}>
            {/* Suv belgisi: skrinshot/foto tarqatilsa kim ekanligi ma'lum bo'ladi */}
            <div aria-hidden className="pointer-events-none fixed inset-0 z-[5] overflow-hidden opacity-[0.05] text-white text-sm font-bold flex flex-wrap gap-x-16 gap-y-12 p-4 -rotate-12 scale-150">
                {Array.from({ length: 150 }).map((_, i) => <span key={i}>{username}</span>)}
            </div>

            {/* Top bar */}
            <div className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-white font-bold truncate">{exam.title}</p>
                    <p className="text-xs text-gray-500">
                        {answeredCount} / {exam.questions.length} javob berildi
                        {flaggedCount > 0 && <span className="text-amber-400"> · {flaggedCount} ta belgilangan</span>}
                    </p>
                </div>

                {testItems.length > 0 && codeItems.length > 0 && (
                    <div className="hidden sm:flex rounded-xl overflow-hidden border border-gray-700 text-xs font-semibold">
                        <button onClick={() => goSection(testItems)} className={`flex items-center gap-1.5 px-4 py-2 ${!isCode ? 'bg-green-900/40 text-green-400' : 'text-gray-400 hover:text-white'}`}>
                            <ListChecks size={13} /> Test ({testDoneCount}/{testItems.length})
                        </button>
                        <button onClick={() => goSection(codeItems)} className={`flex items-center gap-1.5 px-4 py-2 ${isCode ? 'bg-purple-900/40 text-purple-300' : 'text-gray-400 hover:text-white'}`}>
                            <Code2 size={13} /> Practical ({codeDoneCount}/{codeItems.length})
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-3 shrink-0">
                    {violations > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/30 border border-red-800/50 px-2 py-1 rounded-lg">
                            <AlertTriangle size={12} /> {violations}/{MAX_VIOLATIONS}
                        </span>
                    )}
                    <span className={`flex items-center gap-1.5 font-mono font-bold px-3 py-1.5 rounded-xl border ${lowTime ? 'text-red-400 border-red-800 bg-red-900/30 animate-pulse' : 'text-blue-300 border-gray-700 bg-gray-800'}`}>
                        <Clock size={14} /> {fmt(remaining)}
                    </span>
                    <button onClick={() => setConfirmEnd(true)} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-3.5 py-1.5 rounded-xl">
                        <Send size={13} /> Yakunlash
                    </button>
                </div>
                {/* Umumiy progress */}
                <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-gray-800">
                    <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
                </div>
            </div>

            {/* Testlar tugadi: amaliyga o'tish bildirishi */}
            {autoMove && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-purple-900/95 border border-purple-600 text-purple-100 text-sm px-4 py-3 rounded-2xl shadow-2xl">
                    <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                    <span>Barcha testlar yechildi! Amaliy bo&apos;limga o&apos;tilmoqda…</span>
                    <button onClick={cancelAutoMove} className="text-xs underline text-purple-200 hover:text-white shrink-0">Qolish</button>
                </div>
            )}

            {/* Mobil uchun bo'lim tugmalari */}
            {testItems.length > 0 && codeItems.length > 0 && (
                <div className="sm:hidden flex gap-2 px-4 pt-3 relative z-10">
                    <button onClick={() => goSection(testItems)} className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${!isCode ? 'border-green-700 text-green-400' : 'border-gray-700 text-gray-400'}`}>Test {testDoneCount}/{testItems.length}</button>
                    <button onClick={() => goSection(codeItems)} className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${isCode ? 'border-purple-600 text-purple-300' : 'border-gray-700 text-gray-400'}`}>Practical {codeDoneCount}/{codeItems.length}</button>
                </div>
            )}

            <div className={`flex-1 flex flex-col lg:flex-row gap-4 p-4 w-full mx-auto relative z-10 ${isCode ? 'max-w-[1800px]' : 'max-w-6xl'}`}>
                {/* Savollar ro'yxati (faqat joriy bo'lim) */}
                <div className="lg:w-44 shrink-0">
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">{isCode ? 'Practical' : 'Test'}</p>
                    <div className="flex lg:flex-wrap gap-1.5 overflow-x-auto lg:overflow-visible pb-1">
                        {sectionItems.map(({ x, i }, n) => (
                            <button key={x._id} onClick={() => { cancelAutoMove(); setIdx(i); }}
                                className={`relative w-9 h-9 shrink-0 rounded-lg text-xs font-bold border flex items-center justify-center ${
                                    i === idx ? 'border-green-400 bg-green-500/20 text-green-300'
                                    : isDone(x) ? 'border-green-800 bg-green-900/30 text-green-500'
                                    : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500'}`}>
                                {n + 1}
                                {flags[x._id] && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-gray-950" />}
                            </button>
                        ))}
                    </div>
                </div>

                {!isCode ? (
                    /* ── TEST savoli ── */
                    <div className="flex-1 min-w-0 bg-gray-900 border border-gray-800 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border text-green-400 bg-green-900/20 border-green-900/40">
                                {posInSection + 1}-savol · Test
                            </span>
                            <div className="flex items-center gap-2">
                                {flagBtn}
                                <span className="text-xs text-gray-400 flex items-center gap-1"><Trophy size={12} className="text-yellow-400" /> {q.points} ball</span>
                            </div>
                        </div>
                        <p className="text-white font-semibold leading-relaxed whitespace-pre-wrap mb-5">{q.text}</p>
                        <div className="space-y-2">
                            {q.options.map((opt, i) => {
                                const sel = answers[q._id] === i;
                                return (
                                    <button key={i} onClick={() => setAnswers(a => ({ ...a, [q._id]: i }))}
                                        className={`w-full flex items-center gap-3 text-left rounded-xl border-2 px-4 py-3 transition-all ${sel ? 'border-green-500 bg-green-900/20' : 'border-gray-800 bg-gray-800/50 hover:border-gray-600'}`}>
                                        <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold ${sel ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>{LETTERS[i]}</span>
                                        <span className={`text-sm ${sel ? 'text-green-200' : 'text-gray-300'}`}>{opt}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="hidden sm:block text-[11px] text-gray-600 mt-4">Tezkor tugmalar: A–{LETTERS[q.options.length - 1]} — variant tanlash, ← → — savollar orasida yurish.</p>
                        {navButtons}
                    </div>
                ) : (
                    /* ── PRACTICAL savoli: chapda shart, o'ngda IDE ── */
                    <div className="flex-1 min-w-0 grid grid-cols-1 xl:grid-cols-[minmax(300px,2fr)_3fr] gap-4 items-start">
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border text-purple-300 bg-purple-900/20 border-purple-800/50">
                                    {posInSection + 1}-masala · {q.language === 'python' ? 'Python' : 'JavaScript'}
                                </span>
                                <div className="flex items-center gap-2">
                                    {flagBtn}
                                    <span className="text-xs text-gray-400 flex items-center gap-1"><Trophy size={12} className="text-yellow-400" /> {q.points} ball</span>
                                </div>
                            </div>
                            <p className="text-white font-semibold leading-relaxed whitespace-pre-wrap mb-4">{q.text}</p>
                            <p className="text-xs text-gray-500">
                                Dasturni yozing va Run bilan sinab ko&apos;ring. Ballni o&apos;qituvchi kodingizni ko&apos;rib qo&apos;yadi.
                            </p>
                            {navButtons}
                        </div>

                        <CodeIDE
                            key={q._id}
                            language={q.language === 'python' ? 'python' : 'javascript'}
                            value={codes[q._id] ?? ''}
                            onChange={(v) => setCodes(c => ({ ...c, [q._id]: v }))}
                            lines={term[q._id] || []}
                            setLines={setTermFor(q._id)}
                        />
                    </div>
                )}
            </div>

            {/* Yakunlashni tasdiqlash (window.confirm fokusni yo'qotib, qoidabuzarlik hisoblanardi) */}
            {confirmEnd && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
                        <h2 className="text-white font-bold mb-2">Imtihonni yakunlaysizmi?</h2>
                        <p className="text-gray-400 text-sm mb-5">
                            {exam.questions.length - answeredCount > 0
                                ? `${exam.questions.length - answeredCount} ta savolga javob berilmagan. `
                                : ''}
                            Yakunlagandan keyin o&apos;zgartirib bo&apos;lmaydi.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmEnd(false)} className="flex-1 border border-gray-700 text-gray-300 py-2.5 rounded-xl text-sm">Yo&apos;q</button>
                            <button onClick={() => finish('submitted')} disabled={submitting} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl text-sm">
                                {submitting ? 'Yuborilmoqda…' : 'Ha, yakunlash'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

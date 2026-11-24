"use client";

import { useEffect, useState } from "react";
import {
    Trophy, Check, X, HelpCircle, Clock, Code2, ListChecks, ShieldAlert, Hourglass, ArrowLeft,
} from "lucide-react";

const r1 = (n) => Math.round(n * 10) / 10;
const pctOf = (a, b) => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0);

export function grade(p) {
    if (p >= 90) return { label: "A'lo natija!", color: "#22c55e", text: "text-green-400", ring: "from-green-500/20" };
    if (p >= 70) return { label: "Yaxshi natija", color: "#3b82f6", text: "text-blue-400", ring: "from-blue-500/20" };
    if (p >= 55) return { label: "Qoniqarli", color: "#f59e0b", text: "text-amber-400", ring: "from-amber-500/20" };
    return { label: "Qoniqarsiz", color: "#ef4444", text: "text-red-400", ring: "from-red-500/20" };
}

/** Savollar + urinish javoblaridan aniq statistikani hisoblaydi */
export function computeExamStats(exam, attempt) {
    const answers = attempt?.answers || {};
    const s = {
        test: { total: 0, correct: 0, wrong: 0, empty: 0, earned: 0, max: 0 },
        code: { total: 0, graded: 0, pending: 0, empty: 0, earned: 0, max: 0, pendingMax: 0 },
    };

    for (const q of exam.questions) {
        const a = answers[String(q._id)] || {};
        const pts = Number(q.points) || 0;
        const earned = Number(a.earned) || 0;

        if (q.type === "code") {
            s.code.total++;
            s.code.max += pts;
            const written = (a.code || "").trim() && a.code !== q.starterCode;
            if (!written) s.code.empty++;
            else if (a.graded) { s.code.graded++; s.code.earned += earned; }
            else { s.code.pending++; s.code.pendingMax += pts; }
        } else {
            s.test.total++;
            s.test.max += pts;
            s.test.earned += earned;
            if (a.choice === null || a.choice === undefined) s.test.empty++;
            else if (earned > 0 || (pts === 0)) s.test.correct++;
            else s.test.wrong++;
        }
    }

    const max = attempt?.maxScore || s.test.max + s.code.max;
    const score = attempt?.score ?? s.test.earned + s.code.earned;
    const pending = s.code.pendingMax;
    return {
        ...s,
        max,
        score,
        pending,
        percent: pctOf(score, max),
        bestPercent: pctOf(score + pending, max), // amaliylar to'liq ball olsa
    };
}

function Ring({ percent, color }) {
    const radius = 84;
    const circ = 2 * Math.PI * radius;
    const [shown, setShown] = useState(0);
    const [count, setCount] = useState(0);

    useEffect(() => {
        const t = setTimeout(() => setShown(percent), 150);
        return () => clearTimeout(t);
    }, [percent]);

    useEffect(() => {
        const dur = 1400, t0 = performance.now();
        let raf;
        const tick = (now) => {
            const k = Math.min(1, (now - t0) / dur);
            const ease = 1 - Math.pow(1 - k, 3);
            setCount(percent * ease);
            if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [percent]);

    return (
        <div className="relative w-[210px] h-[210px]">
            <svg width="210" height="210" viewBox="0 0 210 210" className="-rotate-90">
                <circle cx="105" cy="105" r={radius} fill="none" stroke="#1f2937" strokeWidth="12" />
                <circle
                    cx="105" cy="105" r={radius} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={circ - (shown / 100) * circ}
                    style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)", filter: `drop-shadow(0 0 8px ${color}66)` }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-extrabold text-white tabular-nums">
                    {r1(count).toFixed(1).replace(/\.0$/, "")}<span className="text-2xl text-gray-400">%</span>
                </span>
            </div>
        </div>
    );
}

function Bar({ value, color }) {
    const [w, setW] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setW(value), 200);
        return () => clearTimeout(t);
    }, [value]);
    return (
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%`, transition: "width 1s ease-out" }} />
        </div>
    );
}

function Stat({ icon: Icon, label, value, sub, tone }) {
    const tones = {
        green: "bg-green-900/20 border-green-800/60 text-green-400",
        red: "bg-red-900/20 border-red-800/60 text-red-400",
        gray: "bg-gray-800/60 border-gray-700 text-gray-400",
        amber: "bg-amber-900/20 border-amber-800/60 text-amber-400",
    };
    return (
        <div className={`rounded-2xl border p-3 text-center ${tones[tone]}`}>
            <Icon size={16} className="mx-auto mb-1" />
            <p className="text-2xl font-extrabold leading-none tabular-nums">{value}</p>
            <p className="text-[11px] text-gray-400 mt-1">{label}</p>
            {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
        </div>
    );
}

export default function ExamResultSummary({ exam, attempt, onBack }) {
    const reasonText = { time: "Vaqt tugadi", violations: "Qoidabuzarliklar limiti oshdi", submitted: "O'zingiz topshirdingiz" }[attempt?.finishReason] || "Yakunlandi";
    const st = computeExamStats(exam, attempt);
    const g = grade(st.percent);
    const hasPending = st.pending > 0;
    const durationMin = attempt?.finishedAt && attempt?.startedAt
        ? Math.max(1, Math.round((new Date(attempt.finishedAt) - new Date(attempt.startedAt)) / 60000))
        : null;

    return (
        <div className="w-full max-w-xl">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden">
                {/* Yuqori qism */}
                <div className={`bg-gradient-to-b ${g.ring} to-transparent px-6 pt-8 pb-6 text-center`}>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-900/70 border border-gray-700 mb-3">
                        <Trophy className={g.text} size={22} />
                    </div>
                    <h1 className="text-xl font-bold text-white">{exam.title}</h1>
                    <p className="text-gray-500 text-xs mt-1">{reasonText}{durationMin ? ` · ${durationMin} daqiqa` : ""}</p>

                    <div className="my-6 flex justify-center"><Ring percent={st.percent} color={g.color} /></div>

                    <p className={`text-lg font-bold ${g.text}`}>{hasPending ? "Dastlabki natija" : g.label}</p>
                    <p className="text-gray-400 text-sm mt-1">
                        <b className="text-white">{r1(st.score)}</b> / {r1(st.max)} ball
                    </p>
                </div>

                <div className="px-6 pb-6 space-y-4">
                    {/* Amaliy baholanmagan bo'lsa — aniq tushuntirish */}
                    {hasPending && (
                        <div className="flex gap-3 rounded-xl bg-amber-900/15 border border-amber-800/50 p-3.5">
                            <Hourglass size={18} className="text-amber-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-200/90 leading-relaxed">
                                <p className="font-semibold text-amber-300 mb-0.5">{st.code.pending} ta amaliy masala tekshirilmoqda</p>
                                Hozirgi natija faqat test va baholangan masalalar bo&apos;yicha. Amaliy ({r1(st.pending)} ball)
                                o&apos;qituvchi tomonidan baholangach, yakuniy foiz{" "}
                                <b className="text-white">{r1(st.percent)}%</b> dan{" "}
                                <b className="text-white">{r1(st.bestPercent)}%</b> gacha o&apos;zgarishi mumkin.
                            </div>
                        </div>
                    )}

                    {/* Test bo'limi */}
                    {st.test.total > 0 && (
                        <div className="bg-gray-950/60 border border-gray-800 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="flex items-center gap-1.5 text-sm font-semibold text-white"><ListChecks size={15} className="text-green-400" /> Test bo&apos;limi</p>
                                <p className="text-xs text-gray-400">
                                    <b className="text-white">{r1(st.test.earned)}</b> / {r1(st.test.max)} ball · <b className="text-green-400">{r1(pctOf(st.test.earned, st.test.max))}%</b>
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                <Stat icon={Check} label="To'g'ri" value={st.test.correct} tone="green" />
                                <Stat icon={X} label="Noto'g'ri" value={st.test.wrong} tone="red" />
                                <Stat icon={HelpCircle} label="Javobsiz" value={st.test.empty} tone="gray" />
                            </div>
                            <div className="space-y-2">
                                {[
                                    ["To'g'ri", st.test.correct, "bg-green-500", "text-green-400"],
                                    ["Noto'g'ri", st.test.wrong, "bg-red-500", "text-red-400"],
                                    ["Javobsiz", st.test.empty, "bg-gray-600", "text-gray-400"],
                                ].map(([label, n, bar, txt]) => {
                                    const p = pctOf(n, st.test.total);
                                    return (
                                        <div key={label}>
                                            <div className="flex justify-between text-[11px] mb-1">
                                                <span className="text-gray-400">{label}</span>
                                                <span className={`font-semibold ${txt}`}>{n} / {st.test.total} · {r1(p)}%</span>
                                            </div>
                                            <Bar value={p} color={bar} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Amaliy bo'lim */}
                    {st.code.total > 0 && (
                        <div className="bg-gray-950/60 border border-gray-800 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="flex items-center gap-1.5 text-sm font-semibold text-white"><Code2 size={15} className="text-purple-400" /> Amaliy bo&apos;lim</p>
                                <p className="text-xs text-gray-400">
                                    {st.code.pending > 0
                                        ? <>Baholangan: <b className="text-white">{r1(st.code.earned)}</b> ball</>
                                        : <><b className="text-white">{r1(st.code.earned)}</b> / {r1(st.code.max)} ball · <b className="text-purple-300">{r1(pctOf(st.code.earned, st.code.max))}%</b></>}
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <Stat icon={Check} label="Baholandi" value={st.code.graded} tone="green" />
                                <Stat icon={Hourglass} label="Kutilmoqda" value={st.code.pending} tone="amber" />
                                <Stat icon={HelpCircle} label="Yozilmagan" value={st.code.empty} tone="gray" />
                            </div>
                        </div>
                    )}

                    {/* Qo'shimcha ma'lumot */}
                    <div className="flex flex-wrap gap-2 text-xs">
                        {durationMin && (
                            <span className="flex items-center gap-1.5 bg-gray-800/60 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg">
                                <Clock size={12} /> Sarflangan vaqt: {durationMin} daq.
                            </span>
                        )}
                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${attempt?.violations > 0 ? "bg-red-900/20 border-red-800/50 text-red-300" : "bg-gray-800/60 border-gray-700 text-gray-300"}`}>
                            <ShieldAlert size={12} /> Qoidabuzarlik: {attempt?.violations || 0}
                        </span>
                    </div>

                    <button onClick={onBack} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl text-sm transition active:scale-[0.98]">
                        <ArrowLeft size={16} /> Imtihonlarga qaytish
                    </button>
                </div>
            </div>
        </div>
    );
}

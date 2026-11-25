"use client";

import { useMemo, useState } from "react";
import {
    Users, TrendingUp, Trophy, TrendingDown, Hourglass, Search, RotateCcw, ChevronDown,
    ShieldAlert, Clock, ListChecks, Code2, Medal,
} from "lucide-react";
import { computeExamStats, grade } from "./ExamResultSummary";

const r1 = (n) => Math.round(n * 10) / 10;
const fmtP = (n) => `${r1(n)}%`;

const REASON = {
    time: { t: "Vaqt tugadi", c: "text-amber-400 border-amber-800/60" },
    violations: { t: "Qoidabuzarlik", c: "text-red-400 border-red-800/60" },
    submitted: { t: "Topshirdi", c: "text-green-400 border-green-800/60" },
};

const BUCKETS = [
    { label: "0–54", min: 0, max: 55, bar: "bg-red-500" },
    { label: "55–69", min: 55, max: 70, bar: "bg-amber-500" },
    { label: "70–89", min: 70, max: 90, bar: "bg-blue-500" },
    { label: "90–100", min: 90, max: 101, bar: "bg-green-500" },
];

function Card({ icon: Icon, label, value, sub, tone = "text-white" }) {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-2"><Icon size={14} /> {label}</div>
            <p className={`text-2xl font-extrabold tabular-nums ${tone}`}>{value}</p>
            {sub && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{sub}</p>}
        </div>
    );
}

function Mini({ icon: Icon, children, className = "" }) {
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] text-gray-400 ${className}`}>
            <Icon size={11} /> {children}
        </span>
    );
}

export default function ExamResultsAdmin({ exam, attempts, openId, setOpenId, onRetake, renderAnswers }) {
    const [q, setQ] = useState("");
    const [sort, setSort] = useState("percent");
    const [filter, setFilter] = useState("all"); // all | pending | violations
    const [showAll, setShowAll] = useState(false); // hamma talabaning javoblarini birdan ochish

    const rows = useMemo(() => attempts.map((a) => {
        const st = computeExamStats(exam, a);
        const mins = a.finishedAt && a.startedAt
            ? Math.max(1, Math.round((new Date(a.finishedAt) - new Date(a.startedAt)) / 60000)) : null;
        return { a, st, mins, finished: a.status === "finished" };
    }), [exam, attempts]);

    const finished = rows.filter((r) => r.finished);
    const pct = finished.map((r) => r.st.percent);
    const avg = pct.length ? pct.reduce((s, x) => s + x, 0) / pct.length : 0;
    const best = finished.reduce((m, r) => (!m || r.st.percent > m.st.percent ? r : m), null);
    const worst = finished.reduce((m, r) => (!m || r.st.percent < m.st.percent ? r : m), null);
    const needGrade = finished.filter((r) => r.st.code.pending > 0).length;
    const flagged = finished.filter((r) => r.a.violations > 0).length;
    const inProgress = rows.length - finished.length;

    const dist = BUCKETS.map((b) => ({ ...b, n: finished.filter((r) => r.st.percent >= b.min && r.st.percent < b.max).length }));
    const maxN = Math.max(1, ...dist.map((d) => d.n));

    const list = useMemo(() => {
        let l = rows.filter((r) => r.a.username.toLowerCase().includes(q.trim().toLowerCase()));
        if (filter === "pending") l = l.filter((r) => r.finished && r.st.code.pending > 0);
        if (filter === "violations") l = l.filter((r) => r.a.violations > 0);
        const by = {
            percent: (x, y) => y.st.percent - x.st.percent,
            name: (x, y) => x.a.username.localeCompare(y.a.username),
            time: (x, y) => (x.mins ?? 1e9) - (y.mins ?? 1e9),
            violations: (x, y) => y.a.violations - x.a.violations,
        }[sort];
        return [...l].sort((x, y) => (x.finished === y.finished ? by(x, y) : x.finished ? -1 : 1));
    }, [rows, q, sort, filter]);

    // O'rin: faqat tugatganlar orasida foiz bo'yicha
    const rankOf = useMemo(() => {
        const m = new Map();
        [...finished].sort((x, y) => y.st.percent - x.st.percent).forEach((r, i) => m.set(r.a._id, i + 1));
        return m;
    }, [finished]);

    const chip = (id, label, n) => (
        <button key={id} onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${filter === id ? "bg-green-900/40 border-green-700 text-green-300" : "border-gray-700 text-gray-400 hover:text-white"}`}>
            {label}{n !== undefined && <span className="ml-1.5 text-gray-500">{n}</span>}
        </button>
    );

    return (
        <div>
            {/* Umumiy ko'rsatkichlar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <Card icon={Users} label="Topshirganlar" value={finished.length}
                    sub={inProgress > 0 ? `${inProgress} ta jarayonda` : `jami ${rows.length} ta urinish`} />
                <Card icon={TrendingUp} label="O'rtacha natija" value={finished.length ? fmtP(avg) : "—"}
                    tone={finished.length ? grade(avg).text : "text-white"}
                    sub={finished.length ? `${r1(finished.reduce((s, r) => s + r.st.score, 0) / finished.length)} / ${r1(exam.questions.reduce((s, x) => s + (Number(x.points) || 0), 0))} ball` : null} />
                <Card icon={Trophy} label="Eng yuqori" value={best ? fmtP(best.st.percent) : "—"} tone="text-green-400" sub={best?.a.username} />
                <Card icon={TrendingDown} label="Eng past" value={worst ? fmtP(worst.st.percent) : "—"} tone="text-red-400" sub={worst?.a.username} />
            </div>

            {(needGrade > 0 || flagged > 0) && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {needGrade > 0 && (
                        <span className="flex items-center gap-1.5 text-xs bg-amber-900/20 border border-amber-800/50 text-amber-300 px-3 py-2 rounded-xl">
                            <Hourglass size={13} /> {needGrade} ta talabaning amaliy masalasi baholanmagan
                        </span>
                    )}
                    {flagged > 0 && (
                        <span className="flex items-center gap-1.5 text-xs bg-red-900/20 border border-red-800/50 text-red-300 px-3 py-2 rounded-xl">
                            <ShieldAlert size={13} /> {flagged} ta talabada qoidabuzarlik bor
                        </span>
                    )}
                </div>
            )}

            {/* Taqsimot */}
            {finished.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Natijalar taqsimoti (foiz bo&apos;yicha)</p>
                    <div className="grid grid-cols-4 gap-3 items-end h-28">
                        {dist.map((d) => (
                            <div key={d.label} className="flex flex-col items-center justify-end h-full gap-1">
                                <span className="text-xs font-bold text-white tabular-nums">{d.n}</span>
                                <div className={`w-full max-w-[64px] rounded-t-lg ${d.bar} transition-all duration-700`}
                                    style={{ height: `${d.n ? Math.max(8, (d.n / maxN) * 72) : 3}px`, opacity: d.n ? 1 : 0.25 }} />
                                <span className="text-[11px] text-gray-500">{d.label}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Boshqaruv */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="relative flex-1 min-w-[180px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Foydalanuvchi qidirish…"
                        className="w-full bg-gray-900 border border-gray-800 text-white text-sm rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-green-600" />
                </div>
                <select value={sort} onChange={(e) => setSort(e.target.value)}
                    className="bg-gray-900 border border-gray-800 text-gray-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-green-600">
                    <option value="percent">Foiz bo&apos;yicha</option>
                    <option value="name">Ism bo&apos;yicha</option>
                    <option value="time">Vaqt bo&apos;yicha</option>
                    <option value="violations">Qoidabuzarlik bo&apos;yicha</option>
                </select>
                <button onClick={() => setShowAll(!showAll)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border ${showAll ? "bg-blue-900/40 border-blue-600 text-blue-200" : "border-gray-800 bg-gray-900 text-gray-300 hover:text-white"}`}>
                    {showAll ? "Javoblarni yig'ish" : "Hamma javoblarni ochish"}
                </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
                {chip("all", "Hammasi", rows.length)}
                {chip("pending", "Baholanmagan", needGrade)}
                {chip("violations", "Qoidabuzarlar", rows.filter((r) => r.a.violations > 0).length)}
            </div>

            {/* Ro'yxat */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {list.length === 0 && <p className="text-center text-gray-500 text-sm py-10">{rows.length === 0 ? "Hali hech kim topshirmagan" : "Hech narsa topilmadi"}</p>}
                {list.map(({ a, st, mins, finished: fin }) => {
                    const g = grade(st.percent);
                    const rank = rankOf.get(a._id);
                    const reason = REASON[a.finishReason];
                    const open = showAll || openId === a._id;
                    return (
                        <div key={a._id} className="border-b border-gray-800 last:border-0">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                                {/* O'rin */}
                                <div className="w-8 text-center shrink-0">
                                    {fin && rank <= 3
                                        ? <Medal size={20} className={["text-yellow-400", "text-gray-300", "text-amber-600"][rank - 1]} />
                                        : <span className="text-xs text-gray-600 font-bold">{fin ? rank : "–"}</span>}
                                </div>

                                {/* Ism va tafsilot */}
                                <div className="flex-1 min-w-[160px]">
                                    <p className="text-white font-semibold text-sm flex items-center gap-2 flex-wrap">
                                        {a.username}
                                        {fin && reason
                                            ? <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${reason.c}`}>{reason.t}</span>
                                            : !fin && <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-yellow-800 text-yellow-400">Jarayonda</span>}
                                        {fin && st.code.pending > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-amber-800/60 text-amber-300">Baholanmagan</span>}
                                    </p>
                                    {fin && (
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                            {st.test.total > 0 && <Mini icon={ListChecks}>Test: {st.test.correct}/{st.test.total} <span className="text-gray-600">({r1(st.test.earned)}/{r1(st.test.max)})</span></Mini>}
                                            {st.code.total > 0 && <Mini icon={Code2}>Amaliy: {st.code.pending > 0 ? `${st.code.pending} ta kutilmoqda` : `${r1(st.code.earned)}/${r1(st.code.max)}`}</Mini>}
                                            {mins && <Mini icon={Clock}>{mins} daq</Mini>}
                                            <Mini icon={ShieldAlert} className={a.violations ? "!text-red-400" : ""}>{a.violations}</Mini>
                                        </div>
                                    )}
                                </div>

                                {/* Foiz va ball */}
                                {fin ? (
                                    <div className="w-44 shrink-0">
                                        <div className="flex items-baseline justify-between mb-1">
                                            <span className={`text-lg font-extrabold tabular-nums ${g.text}`}>{fmtP(st.percent)}</span>
                                            <span className="text-xs text-gray-400 tabular-nums">{r1(st.score)} / {r1(st.max)}</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${st.percent}%`, background: g.color }} />
                                        </div>
                                        {st.code.pending > 0 && (
                                            <p className="text-[10px] text-amber-400/80 mt-1">Yakuniy: {fmtP(st.percent)} – {fmtP(st.bestPercent)}</p>
                                        )}
                                    </div>
                                ) : <div className="w-44 shrink-0 text-xs text-gray-600">Natija yo&apos;q</div>}

                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => { if (showAll) { setShowAll(false); setOpenId(null); } else setOpenId(open ? null : a._id); }}
                                        className="flex items-center gap-1 text-xs text-blue-300 border border-gray-700 hover:border-blue-500 px-2.5 py-1.5 rounded-lg">
                                        Javoblar <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                                    </button>
                                    <button onClick={() => onRetake(a)} title="Qayta topshirishga ruxsat" className="text-gray-500 hover:text-yellow-400 p-1.5"><RotateCcw size={14} /></button>
                                </div>
                            </div>
                            {open && renderAnswers(a)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

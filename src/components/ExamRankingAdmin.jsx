"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Search, RefreshCw, Users, TrendingUp, TrendingDown, FileText, Hourglass, ShieldAlert, Clock, ChevronDown } from "lucide-react";
import { grade } from "./ExamResultSummary";
import AdminPagination, { usePagination } from "./adminPagination";

const r1 = (n) => Math.round(n * 10) / 10;

function Podium({ top }) {
    if (top.length === 0) return null;
    // Tartib: 2-o'rin, 1-o'rin, 3-o'rin
    const order = [top[1], top[0], top[2]].map((u, i) => u && { u, place: [2, 1, 3][i] });
    const h = { 1: "h-24", 2: "h-16", 3: "h-12" };
    const col = { 1: "text-yellow-400", 2: "text-gray-300", 3: "text-amber-600" };
    return (
        <div className="grid grid-cols-3 gap-3 items-end mb-5 max-w-lg mx-auto">
            {order.map((o, i) => o ? (
                <div key={o.u.username} className="flex flex-col items-center">
                    <Medal size={o.place === 1 ? 26 : 20} className={col[o.place]} />
                    <p className="text-white text-xs font-bold truncate max-w-full mt-1">{o.u.username}</p>
                    <p className={`text-sm font-extrabold tabular-nums ${grade(o.u.avgPercent).text}`}>{r1(o.u.avgPercent)}%</p>
                    <div className={`w-full ${h[o.place]} mt-2 rounded-t-xl bg-gradient-to-b from-gray-700 to-gray-800 border border-gray-700 flex items-start justify-center pt-1.5`}>
                        <span className={`text-lg font-black ${col[o.place]}`}>{o.place}</span>
                    </div>
                </div>
            ) : <div key={i} />)}
        </div>
    );
}

const BUCKETS = [
    { label: "0–54%", bar: "bg-red-500", text: "text-red-400" },
    { label: "55–69%", bar: "bg-amber-500", text: "text-amber-400" },
    { label: "70–89%", bar: "bg-blue-500", text: "text-blue-400" },
    { label: "90–100%", bar: "bg-green-500", text: "text-green-400" },
];

function Fact({ icon: Icon, label, value, tone = "text-white" }) {
    return (
        <div className="bg-gray-900/70 border border-gray-800 rounded-lg px-2.5 py-2">
            <p className="flex items-center gap-1 text-[10px] text-gray-500 mb-0.5"><Icon size={10} /> {label}</p>
            <p className={`text-sm font-bold tabular-nums ${tone}`}>{value}</p>
        </div>
    );
}

function ExamCard({ e, totalStudents }) {
    const [open, setOpen] = useState(false);
    const { pageItems, start, pager } = usePagination(e.entries, 5);
    const has = e.participants > 0;
    const g = grade(e.avgPercent);
    const share = totalStudents > 0 ? Math.min(100, (e.participants / totalStudents) * 100) : 0;

    return (
        <div className="bg-gray-950/60 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
            {/* Sarlavha */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-sm text-white font-bold truncate">{e.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{e.questionCount} ta savol · {e.durationMinutes} daqiqa</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-md border shrink-0 ${e.isActive ? "border-green-800 text-green-400 bg-green-900/20" : "border-gray-700 text-gray-400"}`}>
                    {e.isActive ? "Published" : "Draft"}
                </span>
            </div>

            {!has ? (
                <p className="text-xs text-gray-600 py-4 text-center">Hali hech kim topshirmagan</p>
            ) : (
                <>
                    {/* O'rtacha foiz */}
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-500">O&apos;rtacha natija</p>
                            <p className={`text-3xl font-extrabold tabular-nums leading-none mt-1 ${g.text}`}>{e.avgPercent}<span className="text-lg text-gray-500">%</span></p>
                        </div>
                        <p className={`text-xs font-semibold ${g.text}`}>{g.label}</p>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden -mt-1">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${e.avgPercent}%`, background: g.color }} />
                    </div>

                    {/* Qatnashish */}
                    <div>
                        <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-gray-500">Qatnashish</span>
                            <span className="text-gray-300"><b className="text-white">{e.participants}</b> / {totalStudents} talaba · {r1(share)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-sky-500" style={{ width: `${share}%` }} />
                        </div>
                    </div>

                    {/* Taqsimot */}
                    <div>
                        <p className="text-[11px] text-gray-500 mb-1">Natijalar taqsimoti</p>
                        <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-800 gap-px">
                            {e.distribution.map((n, i) => n > 0 && (
                                <div key={i} className={BUCKETS[i].bar} style={{ width: `${(n / e.participants) * 100}%` }} title={`${BUCKETS[i].label}: ${n}`} />
                            ))}
                        </div>
                        <div className="grid grid-cols-4 gap-1 mt-1.5">
                            {BUCKETS.map((b, i) => (
                                <div key={b.label} className="text-center">
                                    <p className={`text-xs font-bold tabular-nums ${e.distribution[i] ? b.text : "text-gray-700"}`}>{e.distribution[i]}</p>
                                    <p className="text-[9px] text-gray-600">{b.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Faktlar */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <Fact icon={Trophy} label="Eng yuqori" value={`${e.bestPercent}%`} tone="text-green-400" />
                        <Fact icon={TrendingDown} label="Eng past" value={`${e.worstPercent}%`} tone="text-red-400" />
                        <Fact icon={Clock} label="O'rtacha vaqt" value={e.avgMinutes ? `${e.avgMinutes} daq` : "—"} />
                        <Fact icon={ShieldAlert} label="Qoidabuzar" value={e.violators} tone={e.violators ? "text-red-400" : "text-white"} />
                        <Fact icon={Hourglass} label="Baholanmagan" value={e.pending} tone={e.pending ? "text-amber-400" : "text-white"} />
                        <Fact icon={Users} label="Topshirdi" value={e.participants} />
                    </div>

                    {/* Imtihon ichidagi reyting */}
                    <button onClick={() => setOpen(!open)} className="flex items-center justify-center gap-1.5 text-xs text-blue-300 border border-gray-700 hover:border-blue-500 rounded-lg py-2">
                        {open ? "Reytingni yashirish" : "Imtihon reytingini ko'rish"} <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>

                    {open && (
                        <div className="border border-gray-800 rounded-xl overflow-hidden">
                            {pageItems.map((x, index) => {
                                const i = start + index; // umumiy ro'yxatdagi o'rni
                                return (
                                <div key={x.username} className="flex items-center gap-3 px-3 py-2 border-b border-gray-800 last:border-0 text-xs">
                                    <span className="w-6 text-center shrink-0">
                                        {i < 3 ? <Medal size={16} className={["text-yellow-400", "text-gray-300", "text-amber-600"][i]} /> : <span className="text-gray-500 font-bold">{i + 1}</span>}
                                    </span>
                                    <span className="flex-1 min-w-0 truncate text-white font-semibold">
                                        {x.username}
                                        {x.pending && <span className="ml-1.5 text-[9px] text-amber-300 border border-amber-800/60 rounded px-1">kutilmoqda</span>}
                                    </span>
                                    <span className="text-gray-500 tabular-nums hidden sm:block">{x.score}/{x.max}</span>
                                    {x.minutes && <span className="text-gray-500 tabular-nums hidden sm:block">{x.minutes} daq</span>}
                                    <span className={`w-12 text-right font-bold tabular-nums ${grade(x.percent).text}`}>{x.percent}%</span>
                                </div>
                                );
                            })}
                            <AdminPagination {...pager} className="px-3 py-2 bg-gray-900/60" />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function ExamBreakdown({ exams, totalStudents }) {
    const [sort, setSort] = useState("avg");
    const list = useMemo(() => [...exams].sort({
        avg: (x, y) => y.avgPercent - x.avgPercent,
        people: (x, y) => y.participants - x.participants,
        name: (x, y) => x.title.localeCompare(y.title),
    }[sort]), [exams, sort]);
    const { pageItems, pager, reset } = usePagination(list, 4);

    return (
        <div className="mb-6">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <p className="text-[11px] uppercase tracking-wider text-gray-500">Imtihonlar kesimida · {exams.length} ta</p>
                <select value={sort} onChange={(e) => { setSort(e.target.value); reset(); }}
                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-green-600">
                    <option value="avg">O&apos;rtacha foiz bo&apos;yicha</option>
                    <option value="people">Qatnashganlar bo&apos;yicha</option>
                    <option value="name">Nomi bo&apos;yicha</option>
                </select>
            </div>
            <div className="grid lg:grid-cols-2 gap-3 items-start">
                {pageItems.map((e) => <ExamCard key={e._id} e={e} totalStudents={totalStudents} />)}
            </div>
            <AdminPagination {...pager} className="mt-3" />
        </div>
    );
}

export default function ExamRankingAdmin() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(null);

    const load = () => {
        setLoading(true); setErr("");
        fetch("/api/admin/exam-ranking")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then(setData)
            .catch(() => setErr("Reytingni yuklab bo'lmadi"))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);

    const ranking = data?.ranking || [];
    const rows = useMemo(() => ranking
        .map((u, i) => ({ ...u, rank: i + 1 }))
        .filter((u) => u.username.toLowerCase().includes(q.trim().toLowerCase())), [ranking, q]);
    const { pageItems, pager, reset } = usePagination(rows, 10);

    const overallAvg = ranking.length ? ranking.reduce((s, u) => s + u.avgPercent, 0) / ranking.length : 0;
    const pendingTotal = ranking.reduce((s, u) => s + u.pending, 0);

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                    <Trophy size={16} className="text-yellow-400" />
                    <h2 className="text-sm font-semibold text-white">Imtihonlar: umumiy reyting</h2>
                    {ranking.length > 0 && <span className="text-xs bg-yellow-900/30 border border-yellow-800/50 text-yellow-400 px-2 py-0.5 rounded-lg font-bold">{ranking.length}</span>}
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/exam/manage" className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-white border border-gray-700 hover:border-blue-500 rounded-lg px-2.5 py-1.5">
                        <FileText size={12} /> Imtihon javoblarini ko&apos;rish
                    </Link>
                    <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white border border-gray-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50">
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Yangilash
                    </button>
                </div>
            </div>

            <div className="p-5">
                {err && <p className="text-red-400 text-sm text-center py-6">{err}</p>}
                {loading && !data && <div className="h-40 bg-gray-800/50 rounded-xl animate-pulse" />}

                {data && (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                            {[
                                { icon: FileText, label: "Imtihonlar", value: data.totalExams, tone: "text-white" },
                                { icon: Users, label: "Qatnashganlar", value: ranking.length, tone: "text-white" },
                                { icon: TrendingUp, label: "Umumiy o'rtacha", value: ranking.length ? `${r1(overallAvg)}%` : "—", tone: ranking.length ? grade(overallAvg).text : "text-white" },
                                { icon: Hourglass, label: "Baholanmagan", value: pendingTotal, tone: pendingTotal ? "text-amber-400" : "text-white" },
                            ].map((c) => (
                                <div key={c.label} className="bg-gray-950/60 border border-gray-800 rounded-xl p-3.5">
                                    <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1.5"><c.icon size={13} /> {c.label}</div>
                                    <p className={`text-xl font-extrabold tabular-nums ${c.tone}`}>{c.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Imtihonlar kesimida */}
                        {data.exams.length > 0 && <ExamBreakdown exams={data.exams} totalStudents={data.totalStudents} />}

                        {ranking.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-8">Hali hech kim imtihon topshirmagan</p>
                        ) : (
                            <>
                                <Podium top={ranking.slice(0, 3)} />

                                <div className="relative mb-3 max-w-xs">
                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Qidirish…"
                                        className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-green-600" />
                                </div>

                                <div className="border border-gray-800 rounded-xl overflow-hidden">
                                    {rows.length === 0 && <p className="text-center text-gray-500 text-sm py-6">Hech narsa topilmadi</p>}
                                    {pageItems.map((u) => {
                                        const g = grade(u.avgPercent);
                                        const isOpen = open === u.username;
                                        return (
                                            <div key={u.username} className="border-b border-gray-800 last:border-0">
                                                <button onClick={() => setOpen(isOpen ? null : u.username)} className="w-full flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-gray-800/40">
                                                    <div className="w-8 text-center shrink-0">
                                                        {u.rank <= 3
                                                            ? <Medal size={20} className={["text-yellow-400", "text-gray-300", "text-amber-600"][u.rank - 1]} />
                                                            : <span className="text-xs font-bold text-gray-500">{u.rank}</span>}
                                                    </div>
                                                    <div className="flex-1 min-w-[140px]">
                                                        <p className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                                                            {u.username}
                                                            {u.pending > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-amber-800/60 text-amber-300">Baholanmagan: {u.pending}</span>}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 flex items-center gap-3">
                                                            <span>{u.examsTaken} / {data.totalExams} imtihon</span>
                                                            <span>{u.totalScore} / {u.totalMax} ball</span>
                                                            {u.violations > 0 && <span className="flex items-center gap-1 text-red-400"><ShieldAlert size={10} /> {u.violations}</span>}
                                                        </p>
                                                    </div>
                                                    <div className="w-44 shrink-0">
                                                        <p className={`text-lg font-extrabold tabular-nums ${g.text}`}>{u.avgPercent}%</p>
                                                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full" style={{ width: `${u.avgPercent}%`, background: g.color }} />
                                                        </div>
                                                    </div>
                                                </button>
                                                {isOpen && (
                                                    <div className="px-4 pb-3 flex flex-wrap gap-2">
                                                        {u.results.map((r) => (
                                                            <span key={r.examId} className="text-[11px] bg-gray-800/70 border border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-300">
                                                                {r.title}: <b className={grade(r.percent).text}>{r.percent}%</b> <span className="text-gray-500">({r.score}/{r.max})</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <AdminPagination {...pager} className="mt-3" />
                                <p className="text-[11px] text-gray-600 mt-2">Reyting: har bir imtihondagi foizlarning o&apos;rtachasi bo&apos;yicha. Teng bo&apos;lsa, jami ball hisobga olinadi.</p>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

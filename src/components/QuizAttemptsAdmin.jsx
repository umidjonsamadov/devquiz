"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCw, Search, ChevronDown, Check, X, Minus } from "lucide-react";
import AdminPagination, { usePagination } from "./adminPagination";

export default function QuizAttemptsAdmin() {
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(null);

    const load = () => {
        setLoading(true); setErr("");
        fetch("/api/admin/quiz-attempts")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => setAttempts(d.attempts || []))
            .catch(() => setErr("Quiz javoblarini yuklab bo'lmadi"))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);

    const rows = useMemo(() => {
        const s = q.trim().toLowerCase();
        return attempts.filter((a) => !s || a.username.toLowerCase().includes(s) || a.category.toLowerCase().includes(s));
    }, [attempts, q]);

    const { pageItems, pager, reset } = usePagination(rows, 10);

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                    <ClipboardList size={16} className="text-sky-400" />
                    <h2 className="text-sm font-semibold text-white">Quiz javoblari</h2>
                    {attempts.length > 0 && <span className="text-xs bg-sky-900/30 border border-sky-800/50 text-sky-400 px-2 py-0.5 rounded-lg font-bold">{attempts.length}</span>}
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Foydalanuvchi yoki kategoriya…"
                            className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-green-600" />
                    </div>
                    <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white border border-gray-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50">
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Yangilash
                    </button>
                </div>
            </div>

            <div className="p-5">
                {err && <p className="text-red-400 text-sm text-center py-6">{err}</p>}
                {!err && !loading && rows.length === 0 && <p className="text-gray-500 text-sm text-center py-8">Hali quiz javoblari yo&apos;q</p>}

                <div className="border border-gray-800 rounded-xl overflow-hidden empty:hidden">
                    {pageItems.map((a) => {
                        const isOpen = open === a._id;
                        const total = a.correct + a.incorrect + a.unanswered;
                        const pct = total ? Math.round((a.correct / total) * 100) : 0;
                        return (
                            <div key={a._id} className="border-b border-gray-800 last:border-0">
                                <button onClick={() => setOpen(isOpen ? null : a._id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/40">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{a.username} <span className="text-gray-500 font-normal">· {a.category}</span></p>
                                        <p className="text-[11px] text-gray-500">{new Date(a.createdAt).toLocaleString()}</p>
                                    </div>
                                    <span className="text-[11px] text-green-400 tabular-nums">{a.correct} ✓</span>
                                    <span className="text-[11px] text-red-400 tabular-nums">{a.incorrect} ✗</span>
                                    <span className="text-[11px] text-gray-500 tabular-nums hidden sm:block">{a.unanswered} —</span>
                                    <span className="w-12 text-right text-sm font-bold tabular-nums text-white">{pct}%</span>
                                    <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                </button>
                                {isOpen && (
                                    <div className="px-4 pb-4 flex flex-col gap-2">
                                        {a.answers.map((x, i) => (
                                            <div key={i} className="bg-gray-950/60 border border-gray-800 rounded-xl p-3">
                                                <p className="text-xs text-white mb-2 flex gap-2">
                                                    {x.choice === null ? <Minus size={14} className="text-gray-500 shrink-0" />
                                                        : x.isCorrect ? <Check size={14} className="text-green-400 shrink-0" />
                                                        : <X size={14} className="text-red-400 shrink-0" />}
                                                    <span>{i + 1}. {x.question}</span>
                                                </p>
                                                <div className="grid sm:grid-cols-2 gap-1.5">
                                                    {x.options.map((o, j) => {
                                                        const right = j === x.correctAnswer;
                                                        const picked = j === x.choice;
                                                        return (
                                                            <div key={j} className={`text-[11px] px-2.5 py-1.5 rounded-lg border ${right ? "border-green-700 bg-green-900/20 text-green-300"
                                                                : picked ? "border-red-700 bg-red-900/20 text-red-300" : "border-gray-800 text-gray-400"}`}>
                                                                {o}{picked && <span className="ml-1 opacity-70">(tanlagan)</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {x.choice === null && <p className="text-[10px] text-gray-500 mt-1.5">Javob berilmagan</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <AdminPagination {...pager} className="mt-3" />
                <p className="text-[11px] text-gray-600 mt-2">Oxirgi 200 ta urinish ko&apos;rsatiladi.</p>
            </div>
        </div>
    );
}

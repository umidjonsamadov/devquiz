"use client";

import { useState } from "react";
import { Check, CheckCheck, Pencil, Trash2, X, Loader2, Zap, Clock } from "lucide-react";
import AdminPagination, { usePagination } from "./adminPagination";
import { XP_MIN, XP_MAX, XP_BY_DIFFICULTY, normalizeXp } from "../lib/quizRules";

const CHUNK = 25;
const LETTERS = ["A", "B", "C", "D"];
const DIFF = {
    Easy: { label: "Oson", cls: "text-green-400 border-green-800/60" },
    Medium: { label: "O'rta", cls: "text-yellow-400 border-yellow-800/60" },
    Hard: { label: "Qiyin", cls: "text-red-400 border-red-800/60" },
};
const input = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-600";

function DraftEditor({ draft, onSaved, onCancel }) {
    const [form, setForm] = useState({
        question: draft.question, options: [...draft.options], correctAnswer: draft.correctAnswer,
        difficulty: draft.difficulty, xpReward: normalizeXp(draft.xpReward, draft.difficulty), time: draft.time,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    const save = async () => {
        setSaving(true); setError("");
        try {
            const res = await fetch(`/api/ai/drafts/${draft._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const d = await res.json();
            if (res.ok) return onSaved(d.draft);
            setError(d.message || "Saqlab bo'lmadi");
        } catch {
            setError("Server javob bermadi");
        }
        setSaving(false);
    };

    return (
        <div className="space-y-2">
            <textarea rows={3} value={form.question} onChange={(e) => set("question", e.target.value)} className={input} aria-label="Savol matni" />
            {form.options.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                    <button type="button" onClick={() => set("correctAnswer", i)} title="To'g'ri javob deb belgilash"
                        className={`w-8 h-8 shrink-0 rounded-lg border text-xs font-bold ${form.correctAnswer === i ? "bg-green-600 border-green-500 text-white" : "border-gray-700 text-gray-500"}`}>
                        {form.correctAnswer === i ? <Check size={13} className="mx-auto" /> : LETTERS[i]}
                    </button>
                    <input value={option} className={input} aria-label={`${LETTERS[i]} varianti`}
                        onChange={(e) => set("options", form.options.map((o, j) => (j === i ? e.target.value : o)))} />
                </div>
            ))}
            <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-500">
                <label>Daraja
                    <select value={form.difficulty} className={input}
                        onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value, xpReward: XP_BY_DIFFICULTY[e.target.value] }))}>
                        {Object.entries(DIFF).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
                    </select>
                </label>
                <label>XP
                    <input type="number" min={XP_MIN} max={XP_MAX} value={form.xpReward} onChange={(e) => set("xpReward", Number(e.target.value))} className={input} />
                </label>
                <label>Vaqt (s)
                    <input type="number" min={5} max={300} value={form.time} onChange={(e) => set("time", Number(e.target.value))} className={input} />
                </label>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white">Bekor qilish</button>
                <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-xs font-semibold text-white disabled:opacity-50">
                    {saving && <Loader2 size={12} className="animate-spin" />} Saqlash
                </button>
            </div>
        </div>
    );
}

/** Tasdiq kutayotgan AI savollari. onChange(fn) ro'yxatni yangilaydi, onReload serverdan qayta o'qiydi */
export default function AiDraftsAdmin({ drafts, onChange, onReload }) {
    const [library, setLibrary] = useState("all");
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const names = [...new Set(drafts.map((d) => d.category))].sort();
    const selected = names.includes(library) ? library : "all";
    const list = selected === "all" ? drafts : drafts.filter((d) => d.category === selected);
    const { pageItems, start, pager, reset } = usePagination(list, 5);

    const act = async (action, ids) => {
        setBusy(true); setMessage(""); setError("");
        const total = { rejected: 0, main: 0, extra: 0, full: 0 };
        try {
            // Ko'p savol bo'laklab yuboriladi, aks holda server vaqt chegarasiga urilishi mumkin
            for (let i = 0; i < ids.length; i += CHUNK) {
                const res = await fetch("/api/ai/drafts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action, ids: ids.slice(i, i + CHUNK) }),
                });
                const d = await res.json();
                if (!res.ok) { setError(d.message || "Xatolik yuz berdi"); break; }
                for (const key of Object.keys(total)) total[key] += d[key] || 0;
                if (ids.length > CHUNK) setMessage(`${Math.min(i + CHUNK, ids.length)} / ${ids.length} bajarildi…`);
            }
        } catch {
            setError("Server javob bermadi");
        }
        if (action === "reject") setMessage(`${total.rejected} ta savol rad etildi`);
        else {
            const parts = [`${total.main + total.extra} ta savol qo'shildi`];
            if (total.extra) parts.push(`shundan ${total.extra} tasi qo'shimcha library'ga`);
            if (total.full) parts.push(`${total.full} tasiga joy yo'q`);
            setMessage(parts.join(", "));
        }
        await onReload();
        setBusy(false);
    };

    // Ommaviy amal faqat ekrandagi filtrga tushgan savollarga tegishli
    const bulk = (action) => {
        const where = selected === "all" ? "Barcha" : `${selected} library'dagi`;
        const verb = action === "approve" ? "library'ga qo'shilsinmi" : "rad etilsinmi";
        if (window.confirm(`${where} ${list.length} ta savol ${verb}?`)) act(action, list.map((d) => d._id));
    };

    return (
        <div className="border-t border-gray-800 pt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-white">Tasdiq kutayotgan savollar</p>
                <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-purple-900/40 border border-purple-800/60 text-purple-300">{drafts.length}</span>
                {drafts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                        <select value={selected} onChange={(e) => { setLibrary(e.target.value); reset(); }} aria-label="Library bo'yicha filtr"
                            className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2.5 py-1.5 outline-none">
                            <option value="all">Barcha library</option>
                            {names.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <button onClick={() => bulk("reject")} disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-900 text-xs text-red-400 hover:bg-red-900/20 disabled:opacity-50">
                            <Trash2 size={12} /> Hammasini rad etish
                        </button>
                        <button onClick={() => bulk("approve")} disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-xs font-semibold text-white disabled:opacity-50">
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={13} />} Hammasini qo&apos;shish ({list.length})
                        </button>
                    </div>
                )}
            </div>

            {message && <p className="text-xs text-green-400">{message}</p>}
            {error && <p className="text-xs text-red-400">{error}</p>}
            {drafts.length === 0 && <p className="text-xs text-gray-600 py-3 text-center">Tasdiq kutayotgan savol yo&apos;q</p>}

            {pageItems.map((draft, index) => (
                <div key={draft._id} className="bg-gray-950/60 border border-gray-800 rounded-xl p-3.5">
                    <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px]">
                        <span className="text-gray-600">{start + index + 1}.</span>
                        <span className="font-semibold text-white">{draft.category}</span>
                        <span className={`px-1.5 rounded border ${DIFF[draft.difficulty].cls}`}>{DIFF[draft.difficulty].label}</span>
                        <span className="flex items-center gap-0.5 text-green-400"><Zap size={10} /> {normalizeXp(draft.xpReward, draft.difficulty)} XP</span>
                        <span className="flex items-center gap-0.5 text-gray-500"><Clock size={10} /> {draft.time}s</span>
                    </div>

                    {editing === draft._id ? (
                        <DraftEditor draft={draft} onCancel={() => setEditing(null)}
                            onSaved={(saved) => { onChange((all) => all.map((d) => (d._id === saved._id ? saved : d))); setEditing(null); }} />
                    ) : (
                        <>
                            <p className="text-sm text-gray-100 whitespace-pre-wrap break-words mb-2.5">{draft.question}</p>
                            <div className="grid sm:grid-cols-2 gap-1.5">
                                {draft.options.map((option, i) => (
                                    <div key={i} className={`flex items-start gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${i === draft.correctAnswer ? "border-green-700 bg-green-900/25 text-green-300 font-semibold" : "border-gray-800 text-gray-400"}`}>
                                        <b>{LETTERS[i]}.</b>
                                        <span className="min-w-0 break-words">{option}</span>
                                        {i === draft.correctAnswer && <Check size={12} className="ml-auto shrink-0 mt-0.5" />}
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2 mt-3">
                                <button onClick={() => act("reject", [draft._id])} disabled={busy}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-900 text-xs text-red-400 hover:bg-red-900/20 disabled:opacity-50">
                                    <X size={12} /> Rad etish
                                </button>
                                <button onClick={() => setEditing(draft._id)} disabled={busy}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-900 text-xs text-blue-400 hover:bg-blue-900/20 disabled:opacity-50">
                                    <Pencil size={12} /> Tahrir
                                </button>
                                <button onClick={() => act("approve", [draft._id])} disabled={busy}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-xs font-semibold text-white disabled:opacity-50">
                                    <Check size={12} /> Qo&apos;shish
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ))}

            <AdminPagination {...pager} />
        </div>
    );
}

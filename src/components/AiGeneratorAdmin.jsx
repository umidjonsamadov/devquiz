"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Play, Square, Loader2, AlertCircle, Check } from "lucide-react";
import AiDraftsAdmin from "./AiDraftsAdmin";

const RESULT = {
    done: "Bugungi reja bajarilgan",
    busy: "Generatsiya allaqachon ishlayapti",
    full: "Tanlangan library'larda bo'sh joy yo'q",
    "no-library": "Avval kamida bitta library tanlang",
    "no-key": "GEMINI_API_KEY sozlanmagan",
};

const Warning = ({ children }) => (
    <p className="flex items-start gap-2 text-xs text-amber-300 bg-amber-900/20 border border-amber-800/50 rounded-xl p-3">
        <AlertCircle size={14} className="shrink-0" /> {children}
    </p>
);

export default function AiGeneratorAdmin() {
    const [data, setData] = useState(null);
    const [drafts, setDrafts] = useState([]);
    const [running, setRunning] = useState(false);
    const [saving, setSaving] = useState(null); // saqlanayotgan library ID
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const getJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject()));
    const loadStatus = () => getJson("/api/ai/generate").then(setData)
        .catch(() => setError("AI holatini yuklab bo'lmadi"));
    const loadDrafts = () => getJson("/api/ai/drafts").then((d) => setDrafts(d.drafts || []))
        .catch(() => setError("Kutayotgan savollarni yuklab bo'lmadi"));
    useEffect(() => { loadStatus(); loadDrafts(); }, []);

    const toggle = async (library) => {
        setSaving(library.id); setError("");
        const res = await fetch("/api/ai/libraries", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: library.id, enabled: !library.enabled }),
        }).catch(() => null);
        if (!res?.ok) setError("Tanlovni saqlab bo'lmadi");
        await loadStatus();
        setSaving(null);
    };

    const activeRef = useRef(null); // davom etayotgan ishga tushirish
    const totalRef = useRef(0);

    // Brauzer so'rovi darhol uziladi, serverga esa natijani bekor qilish aytiladi
    const cancel = () => {
        const active = activeRef.current;
        if (!active) return null;
        activeRef.current = null;
        active.controller.abort();
        return fetch(`/api/ai/generate?session=${active.session}`, { method: "DELETE", keepalive: true })
            .then((r) => r.ok)
            .catch(() => false);
    };
    // Sahifadan chiqilsa ham to'xtaydi
    useEffect(() => () => { cancel(); }, []);

    const stop = async () => {
        const request = cancel();
        if (!request) return;
        const total = totalRef.current;
        setRunning(false);
        setMessage(total ? `To'xtatildi. ${total} ta savol tuzilgan` : "To'xtatildi");
        if (!(await request)) setError("Serverga to'xtatish buyrug'i yetmadi: oxirgi partiya saqlanib qolishi mumkin");
        await Promise.all([loadStatus(), loadDrafts()]);
    };

    // Partiyalarni ketma-ket so'raydi: reja bajarilguncha, xato chiqquncha yoki "To'xtatish" bosilguncha
    const runNow = async () => {
        const active = { session: crypto.randomUUID(), controller: new AbortController() };
        activeRef.current = active;
        totalRef.current = 0;
        const { signal } = active.controller;
        setRunning(true); setMessage(""); setError("");
        let total = 0, empty = 0;
        const summary = (text) => (total ? `${total} ta savol tuzildi. ${text}` : text);
        try {
            while (!signal.aborted) {
                const res = await fetch(`/api/ai/generate?session=${active.session}`, { method: "POST", signal });
                const d = await res.json();
                if (signal.aborted) return;
                if (d.status !== "ok") {
                    if (RESULT[d.status]) setMessage(summary(RESULT[d.status]));
                    else {
                        if (total) setMessage(`${total} ta savol tuzildi`);
                        setError(d.message || "Xatolik yuz berdi");
                    }
                    break;
                }
                total += d.created;
                totalRef.current = total;
                empty = d.created ? 0 : empty + 1;
                setMessage(`${total} ta savol tuzildi (oxirgi partiya: ${d.model}), davom etyapti…`);
                await Promise.all([loadStatus(), loadDrafts()]);
                if (signal.aborted) return;
                // Ketma-ket ikki marta yangi savol chiqmasa, limitni behuda sarflamaymiz
                if (empty >= 2) {
                    setMessage(summary("AI yangi savol topa olmayapti, to'xtatildi"));
                    break;
                }
            }
        } catch {
            if (signal.aborted) return; // to'xtatishni stop() o'zi ko'rsatadi
            setError("Server javob bermadi");
        }
        activeRef.current = null;
        await Promise.all([loadStatus(), loadDrafts()]);
        setRunning(false);
    };

    const run = data?.run;
    const libraries = data?.libraries || [];
    const chosen = libraries.filter((l) => l.enabled).length;
    const percent = run ? Math.min(100, (run.created / run.target) * 100) : 0;

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-4 border-b border-gray-800">
                <div className="flex items-center gap-2.5">
                    <Sparkles size={16} className="text-purple-400" />
                    <h2 className="text-sm font-semibold text-white">AI savol generatori</h2>
                </div>
                <div className="flex items-center gap-2">
                    {running && (
                        <button onClick={stop}
                            className="flex items-center gap-1.5 text-xs font-semibold text-red-400 border border-red-900 hover:bg-red-900/20 rounded-lg px-3 py-1.5">
                            <Square size={11} /> To&apos;xtatish
                        </button>
                    )}
                    <button onClick={runNow} disabled={running || !data?.configured || !chosen || (run && run.created >= run.target)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg px-3 py-1.5 disabled:opacity-40">
                        {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                        {running ? "Tuzilmoqda…" : "Hozir ishga tushirish"}
                    </button>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {!data && !error && <div className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />}
                {data && !data.configured && <Warning>GEMINI_API_KEY sozlanmagan, AI ishlamaydi.</Warning>}
                {data?.configured && !data.scheduled && <Warning>CRON_SECRET sozlanmagan: avtomatik jadval ishlamaydi, faqat tugma orqali.</Warning>}

                {data && (
                    <div>
                        <p className="text-xs text-gray-400 mb-2">AI qaysi library&apos;lar uchun savol tuzsin? <span className="text-gray-600">({chosen} ta tanlangan)</span></p>
                        <div className="flex flex-wrap gap-2">
                            {libraries.map((l) => (
                                <button key={l.id} onClick={() => toggle(l)} disabled={saving !== null} aria-pressed={l.enabled}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-60 ${l.enabled ? "bg-purple-900/40 border-purple-600 text-purple-200" : "border-gray-700 text-gray-400 hover:text-white"}`}>
                                    {saving === l.id ? <Loader2 size={12} className="animate-spin" /> : l.enabled && <Check size={12} />}
                                    {l.name}
                                </button>
                            ))}
                            {libraries.length === 0 && <span className="text-xs text-gray-600">Library yo&apos;q. Avval Create Question sahifasida yarating.</span>}
                        </div>
                        {libraries.length > 0 && !chosen && <p className="text-xs text-amber-300 mt-2">Hech biri tanlanmagan: AI savol tuzmaydi.</p>}
                    </div>
                )}

                {run && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Bugun ({run.date}) tuzildi</span>
                            <span className="text-white font-semibold">{run.created} / {run.target} savol</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                        <p className="text-[11px] text-gray-600">
                            Har soatda {data.batch} tagacha savol tuziladi. Tugma rejani ketma-ket bajaradi:
                            to&apos;xtatilguncha sahifani yopmang.{" "}
                            Savollar siz ruxsat bermaguningizcha hech kimga ko&apos;rinmaydi.
                        </p>
                        {run.lastError && <p className="text-xs text-red-400">Oxirgi xato: {run.lastError}</p>}
                    </div>
                )}

                {message && <p className="text-xs text-green-400">{message}</p>}
                {error && <p className="text-xs text-red-400">{error}</p>}

                {data && <AiDraftsAdmin drafts={drafts} onChange={setDrafts} onReload={() => Promise.all([loadDrafts(), loadStatus()])} />}
            </div>
        </div>
    );
}

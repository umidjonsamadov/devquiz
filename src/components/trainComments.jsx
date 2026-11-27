'use client';

import { useState } from 'react';
import { Trash2, Loader2, Send } from 'lucide-react';

const when = (d) => new Date(d).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** comments: null (yuklanmoqda) | massiv; onChange(fn) ro'yxatni yangilaydi */
export default function TrainComments({ problemId, comments, loadError, onChange }) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const base = `/api/train/problems/${problemId}/comments`;

    const send = async (e) => {
        e.preventDefault();
        if (!text.trim() || sending) return;
        setSending(true);
        setError('');
        try {
            const res = await fetch(base, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            const d = await res.json();
            if (res.ok) { onChange(list => [d.comment, ...(list || [])]); setText(''); }
            else setError(d.message || 'Xatolik yuz berdi');
        } catch {
            setError("Yuborib bo'lmadi");
        }
        setSending(false);
    };

    const remove = async (commentId) => {
        if (!window.confirm("Izohni o'chirasizmi?")) return;
        setError('');
        const res = await fetch(`${base}/${commentId}`, { method: 'DELETE' }).catch(() => null);
        if (res?.ok) onChange(list => list.filter(c => c._id !== commentId));
        else setError("O'chirib bo'lmadi");
    };

    return (
        <div className="space-y-4">
            <form onSubmit={send} className="rounded-lg border border-gray-800 bg-gray-950 focus-within:border-gray-600">
                <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={1000}
                    placeholder="Izoh yozing…"
                    className="w-full bg-transparent p-3 text-sm text-white placeholder:text-gray-600 outline-none resize-y" />
                <div className="flex items-center justify-between px-3 pb-2">
                    <span className="text-[11px] text-gray-600">{text.length}/1000</span>
                    <button type="submit" disabled={!text.trim() || sending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-semibold">
                        {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Yuborish
                    </button>
                </div>
            </form>

            {(error || loadError) && <p className="text-xs text-red-400">{error || loadError}</p>}

            {comments === null ? (
                !loadError && <p className="text-center text-sm text-gray-600 py-6">Yuklanmoqda…</p>
            ) : comments.length === 0 ? (
                <p className="text-center text-sm text-gray-600 py-6">Hozircha izoh yo&apos;q. Birinchi bo&apos;lib yozing.</p>
            ) : comments.map(c => (
                <div key={c._id} className="flex gap-3">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-300">
                        {c.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 border-b border-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white truncate">{c.username}</span>
                            <span className="text-[11px] text-gray-600 shrink-0">{when(c.createdAt)}</span>
                            {c.canDelete && (
                                <button onClick={() => remove(c._id)} title="O'chirish" className="ml-auto text-gray-600 hover:text-red-400">
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>
                        <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap break-words">{c.text}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

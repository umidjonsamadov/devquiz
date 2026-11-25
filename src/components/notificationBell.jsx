'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';

const POLL_MS = 30 * 1000;

function timeAgo(date) {
    const s = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (s < 60) return 'hozirgina';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} daq oldin`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} soat oldin`;
    const d = Math.floor(h / 24);
    return `${d} kun oldin`;
}

export default function NotificationBell() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const [toast, setToast] = useState(null);
    const wrapRef = useRef(null);
    const prevUnread = useRef(null); // birinchi yuklashda toast ko'rsatmaslik uchun
    const toastTimer = useRef(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/user/notifications', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            const list = data.notifications || [];
            setItems(list);
            setUnread(data.unreadCount || 0);

            // Yangi o'qilmagan bildirishnoma kelsa — qisqa toast
            if (prevUnread.current !== null && (data.unreadCount || 0) > prevUnread.current) {
                const newest = list.find(n => !n.read);
                if (newest) {
                    setToast(newest);
                    clearTimeout(toastTimer.current);
                    toastTimer.current = setTimeout(() => setToast(null), 5000);
                }
            }
            prevUnread.current = data.unreadCount || 0;
        } catch {}
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(load, POLL_MS);
        // Quiz tugagach, mukofot olingach va h.k. — darrov yangilaymiz
        const refresh = () => setTimeout(load, 800);
        window.addEventListener('user-updated', refresh);
        window.addEventListener('focus', load);
        return () => {
            clearInterval(id);
            clearTimeout(toastTimer.current);
            window.removeEventListener('user-updated', refresh);
            window.removeEventListener('focus', load);
        };
    }, [load]);

    // Tashqariga bosilsa yopiladi
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('touchstart', onDown);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('touchstart', onDown);
        };
    }, [open]);

    async function markRead(n) {
        if (!n.read) {
            setItems(list => list.map(x => (x._id === n._id ? { ...x, read: true } : x)));
            setUnread(u => Math.max(0, u - 1));
            prevUnread.current = Math.max(0, (prevUnread.current ?? 1) - 1);
            fetch('/api/user/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: n._id }),
            }).catch(() => {});
        }
        if (n.link) { setOpen(false); router.push(n.link); }
    }

    async function markAll() {
        setItems(list => list.map(x => ({ ...x, read: true })));
        setUnread(0);
        prevUnread.current = 0;
        fetch('/api/user/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ all: true }),
        }).catch(() => {});
    }

    async function clearAll() {
        setItems([]);
        setUnread(0);
        prevUnread.current = 0;
        fetch('/api/user/notifications', { method: 'DELETE' }).catch(() => {});
    }

    return (
        <div ref={wrapRef} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                aria-label="Bildirishnomalar"
                className="relative p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
                <Bell size={18} className={unread > 0 ? 'text-white' : 'text-gray-400'} />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-green-500 text-gray-950 text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-gray-900">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="fixed left-2 right-2 top-[68px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 z-[100] bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                        <p className="text-white font-semibold text-sm">
                            Bildirishnomalar {unread > 0 && <span className="text-green-400">({unread})</span>}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={markAll}
                                disabled={unread === 0}
                                title="Hammasini o'qilgan qilish"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <CheckCheck size={15} />
                            </button>
                            <button
                                onClick={clearAll}
                                disabled={items.length === 0}
                                title="Hammasini o'chirish"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    </div>

                    <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="py-12 text-center">
                                <div className="text-3xl mb-2">🔔</div>
                                <p className="text-gray-500 text-sm">Hozircha bildirishnoma yo'q</p>
                                <p className="text-gray-600 text-xs mt-1">Yutuq va mukofotlar shu yerda chiqadi</p>
                            </div>
                        ) : items.map(n => (
                            <button
                                key={n._id}
                                onClick={() => markRead(n)}
                                className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-800/60 last:border-0 transition-colors hover:bg-gray-800/60 ${
                                    n.read ? '' : 'bg-green-900/10'
                                }`}
                            >
                                <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center text-lg shrink-0">
                                    {n.emoji || '🔔'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm leading-snug ${n.read ? 'text-gray-300 font-medium' : 'text-white font-semibold'}`}>
                                        {n.title}
                                    </p>
                                    {n.message && <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>}
                                    <p className="text-[11px] text-gray-600 mt-1">{timeAgo(n.createdAt)}</p>
                                </div>
                                {!n.read && <span className="w-2 h-2 bg-green-400 rounded-full mt-1.5 shrink-0" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Yangi bildirishnoma toast'i */}
            {toast && !open && (
                <div className="fixed top-[72px] right-3 left-3 sm:left-auto sm:w-80 z-[150]">
                    <button
                        onClick={() => { setToast(null); markRead(toast); }}
                        className="w-full text-left flex items-start gap-3 bg-gray-900 border border-green-800/60 rounded-2xl px-4 py-3 shadow-2xl"
                    >
                        <div className="w-9 h-9 rounded-xl bg-green-900/40 flex items-center justify-center text-lg shrink-0">
                            {toast.emoji || '🔔'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold leading-snug">{toast.title}</p>
                            {toast.message && <p className="text-xs text-gray-400 mt-0.5">{toast.message}</p>}
                        </div>
                        <span
                            onClick={(e) => { e.stopPropagation(); setToast(null); }}
                            className="text-gray-500 hover:text-white p-0.5"
                        >
                            <X size={14} />
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

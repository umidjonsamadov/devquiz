'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Zap, Gift, Check, Lock } from 'lucide-react';
import { formatDuration } from '../../lib/formatDuration';

const TABS = [
    { key: 'day',   label: 'Kunlik' },
    { key: 'week',  label: 'Haftalik' },
    { key: 'month', label: 'Oylik' },
    { key: 'life',  label: 'Unvonlar' },
];

const TILES = [
    { key: 'day',   label: 'Bugun' },
    { key: 'week',  label: 'Shu hafta' },
    { key: 'month', label: 'Shu oy' },
    { key: 'life',  label: 'Jami' },
];

function RewardRow({ r, busy, onClaim }) {
    const pct = Math.round((r.progress / r.target) * 100);
    const done = r.claimed;
    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
            r.reached && !done ? 'bg-green-900/15 border-green-800/60'
            : done ? 'bg-gray-800/40 border-gray-800'
            : 'bg-gray-800/60 border-gray-800'
        }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                r.reached ? 'bg-gray-800' : 'bg-gray-900 grayscale opacity-60'
            }`}>
                {r.reached ? r.emoji : <Lock size={14} className="text-gray-500" />}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold truncate ${done ? 'text-gray-500' : 'text-white'}`}>{r.title}</p>
                    <span className="flex items-center gap-0.5 text-xs font-bold text-green-400 shrink-0">
                        <Zap size={11} /> +{r.xp} XP
                    </span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mt-1.5">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${r.reached ? 'bg-green-400' : 'bg-green-700'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    {formatDuration(r.progress)} / {formatDuration(r.target)}
                </p>
            </div>

            <div className="shrink-0 w-[76px] flex justify-end">
                {done ? (
                    <span className="flex items-center gap-1 text-xs text-gray-500 font-semibold">
                        <Check size={13} /> Olingan
                    </span>
                ) : r.reached ? (
                    <button
                        onClick={() => onClaim(r.id)}
                        disabled={busy}
                        className="flex items-center gap-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                        <Gift size={12} /> Olish
                    </button>
                ) : (
                    <span className="text-xs text-gray-600 font-semibold">{pct}%</span>
                )}
            </div>
        </div>
    );
}

export default function TimeRewards({ onClaimed }) {
    const [data, setData] = useState(null);
    const [tab, setTab] = useState('day');
    const [busyId, setBusyId] = useState(null);
    const [toast, setToast] = useState('');

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/user/time-rewards');
            if (res.ok) setData(await res.json());
        } catch {}
    }, []);

    useEffect(() => {
        load();
        // Vaqt o'sib borishi uchun har 30 soniyada yangilab turamiz
        const id = setInterval(load, 30000);
        return () => clearInterval(id);
    }, [load]);

    async function claim(id) {
        setBusyId(id);
        try {
            const res = await fetch('/api/user/time-rewards/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            const body = await res.json().catch(() => ({}));
            if (res.ok) {
                setToast(`+${body.xp} XP olindi! 🎉`);
                onClaimed?.(body.xp);
                window.dispatchEvent(new Event('user-updated'));
            } else {
                setToast(body.message || 'Xatolik');
            }
            setTimeout(() => setToast(''), 2500);
            await load();
        } finally {
            setBusyId(null);
        }
    }

    const rewards = (data?.rewards || []).filter(r => r.period === tab);
    const readyCount = (data?.rewards || []).filter(r => r.reached && !r.claimed).length;
    const readyIn = p => (data?.rewards || []).filter(r => r.period === p && r.reached && !r.claimed).length;

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
                    <Clock size={16} className="text-green-400" /> Saytdagi vaqt va mukofotlar
                </h3>
                {readyCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-bold bg-green-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                        <Gift size={11} /> {readyCount} ta tayyor
                    </span>
                )}
            </div>

            {/* Vaqt kartalari */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {TILES.map(t => (
                    <div key={t.key} className="bg-gray-800 rounded-xl p-3">
                        <p className="text-white font-bold text-sm sm:text-base leading-tight">
                            {data ? formatDuration(data.seconds[t.key]) : '—'}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">{t.label}</p>
                    </div>
                ))}
            </div>

            {/* Tablar */}
            <div className="flex gap-1 bg-gray-800 p-1 rounded-xl mb-3">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`relative flex-1 text-xs sm:text-sm font-semibold py-1.5 rounded-lg transition-colors ${
                            tab === t.key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        {t.label}
                        {readyIn(t.key) > 0 && (
                            <span className="absolute top-1 right-1.5 w-2 h-2 bg-green-400 rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            <div className="space-y-2">
                {!data ? (
                    <p className="text-gray-500 text-sm py-4 text-center">Yuklanmoqda…</p>
                ) : rewards.map(r => (
                    <RewardRow key={r.id} r={r} busy={busyId === r.id} onClaim={claim} />
                ))}
            </div>

            <p className="text-xs text-gray-600 mt-3">
                Kunlik mukofotlar har kuni, haftalik — har dushanba, oylik — har oy boshida yangilanadi. Unvonlar bir marta beriladi.
            </p>

            {toast && (
                <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg">
                    {toast}
                </div>
            )}
        </div>
    );
}

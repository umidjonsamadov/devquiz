'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Code2, Lock, Trophy, Flame, Target, Zap, CircleCheck, Eye, ThumbsUp, ThumbsDown, MessageSquare, Users } from 'lucide-react';
import TrainDailyChart, { shortDate } from './trainDailyChart';
import { DIFFICULTY, LANGUAGES, TRAIN_LEVEL, dailySeries, solveStreaks } from '../lib/train';

const TEXT = { Easy: 'text-teal-400', Medium: 'text-yellow-400', Hard: 'text-red-400' };
const BAR = { Easy: 'bg-teal-400', Medium: 'bg-yellow-400', Hard: 'bg-red-500' };

function Card({ title, children, className = '' }) {
    return (
        <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-5 ${className}`}>
            <h4 className="text-sm font-semibold text-white mb-3">{title}</h4>
            {children}
        </div>
    );
}

function Meter({ label, labelCls = 'text-gray-300', barCls, value, total }) {
    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className={`font-semibold ${labelCls}`}>{label}</span>
                <span className="text-gray-400">{value} ta</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div className={`h-full rounded-full ${barCls}`} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
            </div>
        </div>
    );
}

export default function TrainProfileStats() {
    const [state, setState] = useState({ loading: true });

    useEffect(() => {
        fetch('/api/train/stats')
            .then(async (res) => {
                const d = await res.json();
                if (d.locked) setState({ locked: d });
                else if (!res.ok) setState({ error: d.message || 'Xatolik yuz berdi' });
                else setState({ data: d });
            })
            .catch(() => setState({ error: "Serverga ulanib bo'lmadi" }));
    }, []);

    const header = (
        <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-semibold text-white text-sm sm:text-base">
                <Code2 size={17} className="text-green-400" /> Train statistikasi
            </h3>
            {state.data && <Link href="/train" className="text-xs text-green-400 hover:text-green-300">Masalalarga o&apos;tish →</Link>}
        </div>
    );

    if (!state.data) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-3">
                {header}
                {state.loading && <p className="text-sm text-gray-600">Yuklanmoqda…</p>}
                {state.error && <p className="text-sm text-red-400">{state.error}</p>}
                {state.locked && (
                    <p className="flex items-center gap-2 text-sm text-gray-500">
                        <Lock size={14} /> Train Level {TRAIN_LEVEL} dan ochiladi. Hozir: Level {state.locked.level}.
                    </p>
                )}
            </div>
        );
    }

    const { solves, submissions, totals, rank, rankedCount, authored } = state.data;
    const streaks = solveStreaks(solves);
    const points = solves.reduce((sum, s) => sum + s.xp, 0);
    const acceptance = totals.submissions ? Math.round((totals.accepted / totals.submissions) * 100) : null;

    const tiles = [
        { label: 'Yechilgan', value: solves.length, icon: CircleCheck, cls: 'text-teal-400' },
        { label: 'Train bali', value: points.toLocaleString(), icon: Zap, cls: 'text-green-400' },
        { label: "Reytingdagi o'rin", value: rank ? `#${rank}` : '—', sub: rankedCount ? `${rankedCount} kishidan` : null, icon: Trophy, cls: 'text-yellow-400' },
        { label: 'Qabul darajasi', value: acceptance === null ? '—' : `${acceptance}%`, sub: `${totals.accepted}/${totals.submissions} urinish`, icon: Target, cls: 'text-blue-400' },
        { label: 'Train streak', value: `${streaks.current} kun`, sub: `Rekord: ${streaks.best} kun`, icon: Flame, cls: 'text-orange-400' },
    ];

    return (
        <div className="space-y-3">
            {header}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {tiles.map(({ label, value, sub, icon: Icon, cls }) => (
                    <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                        <Icon size={17} className={`mb-2 ${cls}`} />
                        <p className="text-xl font-extrabold text-white leading-tight">{value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                        {sub && <p className="text-[11px] text-gray-600 mt-1">{sub}</p>}
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-3">
                <Card title="Kunlik natija · so'nggi 30 kun" className="lg:col-span-2">
                    <TrainDailyChart series={dailySeries(solves, submissions, 30)} height={140} />
                </Card>
                <Card title="Qiyinlik va tillar">
                    <div className="space-y-3">
                        {Object.entries(DIFFICULTY).map(([k, v]) => (
                            <Meter key={k} label={v.label} labelCls={TEXT[k]} barCls={BAR[k]}
                                value={solves.filter(s => s.difficulty === k).length} total={solves.length} />
                        ))}
                        <div className="border-t border-gray-800 pt-3 space-y-3">
                            {Object.entries(LANGUAGES).map(([k, label]) => (
                                <Meter key={k} label={label} barCls="bg-blue-500"
                                    value={solves.filter(s => s.language === k).length} total={solves.length} />
                            ))}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-3">
                <Card title="So'nggi yechilganlar" className="lg:col-span-2">
                    {solves.length === 0 ? (
                        <p className="text-sm text-gray-600">Hali masala yechilmagan.</p>
                    ) : (
                        <div className="divide-y divide-gray-800">
                            {solves.slice(0, 6).map(s => (
                                <div key={s.problemId} className="flex items-center gap-3 py-2 text-sm">
                                    {s.title
                                        ? <Link href={`/train/${s.problemId}`} className="flex-1 min-w-0 truncate text-gray-200 hover:text-white">{s.title}</Link>
                                        : <span className="flex-1 min-w-0 truncate text-gray-600 italic">O&apos;chirilgan masala</span>}
                                    <span className="hidden sm:block text-xs text-gray-500">{LANGUAGES[s.language]}</span>
                                    <span className={`w-12 text-right text-xs font-semibold ${TEXT[s.difficulty]}`}>{DIFFICULTY[s.difficulty].label}</span>
                                    <span className="w-14 text-right text-xs text-gray-500">{shortDate(s.solvedAt)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
                <Card title="Qo'shgan masalalarim">
                    <p className="text-3xl font-black text-white leading-none">{authored.count}</p>
                    <p className="text-xs text-gray-500 mt-1 mb-3">ta masala</p>
                    <div className="space-y-2 text-sm">
                        {[
                            [Eye, "Ko'rishlar", authored.views],
                            [Users, 'Yechishlar', authored.solved],
                            [ThumbsUp, 'Like', authored.likes],
                            [ThumbsDown, 'Dislike', authored.dislikes],
                            [MessageSquare, 'Izohlar', authored.comments],
                        ].map(([Icon, label, value]) => (
                            <div key={label} className="flex items-center gap-2">
                                <Icon size={14} className="text-gray-500" />
                                <span className="text-gray-400">{label}</span>
                                <span className="ml-auto font-semibold text-white">{value}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}

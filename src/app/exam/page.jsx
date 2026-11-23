"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Clock, ListChecks, Code2, Trophy, Settings2, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function ExamListPage() {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        fetch('/api/exams').then(r => r.ok ? r.json() : null).then(d => d && setExams(d.exams || []))
            .finally(() => setLoading(false));
        fetch('/api/auth/me').then(r => r.ok ? r.json() : null)
            .then(d => setIsAdmin(d?.user?.username === 'username')).catch(() => {});
    }, []);

    return (
        <div className="min-h-screen bg-gray-950 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-900/30 border border-green-800/50 flex items-center justify-center">
                        <GraduationCap size={18} className="text-green-400" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-extrabold text-white">Exams</h1>
                        <p className="text-gray-500 text-xs sm:text-sm">Fullscreen, timed. Tests and practical coding tasks</p>
                    </div>
                </div>
                {isAdmin && (
                    <Link href="/exam/manage"
                        className="flex items-center gap-2 bg-green-900/30 border border-green-800/50 hover:border-green-600 text-green-400 px-3 py-2 rounded-xl text-sm font-medium">
                        <Settings2 size={14} /> Manage
                    </Link>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-24">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : exams.length === 0 ? (
                <p className="text-center text-gray-500 py-24 text-sm">Hozircha ochiq imtihon yo&apos;q</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {exams.map(e => {
                        const done = e.attempt?.status === 'finished';
                        return (
                            <div key={e._id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h2 className="text-lg font-bold text-white">{e.title}</h2>
                                    {!e.isActive && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-800 text-gray-400 border border-gray-700">Yopiq</span>}
                                </div>
                                {e.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{e.description}</p>}
                                <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-4">
                                    <span className="flex items-center gap-1"><Clock size={12} /> {e.durationMinutes} daqiqa</span>
                                    <span className="flex items-center gap-1"><ListChecks size={12} /> {e.questionCount - e.codeCount} test</span>
                                    <span className="flex items-center gap-1"><Code2 size={12} /> {e.codeCount} amaliy</span>
                                    <span className="flex items-center gap-1"><Trophy size={12} /> {e.totalPoints} ball</span>
                                </div>
                                <div className="mt-auto pt-3 border-t border-gray-800">
                                    {done ? (
                                        <div className="flex items-center gap-2 text-sm text-green-400 font-semibold">
                                            <CheckCircle2 size={15} /> Topshirildi: {e.attempt.score} / {e.attempt.maxScore}
                                        </div>
                                    ) : (
                                        <Link href={`/exam/${e._id}`}
                                            className="flex items-center justify-center gap-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl text-sm">
                                            {e.attempt ? 'Davom ettirish' : 'Ochish'} <ChevronRight size={15} />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, Search, Trash2, RefreshCw, Copy, Camera, Users } from 'lucide-react';
import AdminPagination, { usePagination } from '../../components/adminPagination';
import { VIOLATION_TYPES, VIOLATION_SOURCES, VIOLATION_METHODS } from '../../lib/violations';

const ACTION = { copy: 'nusxalashga', screenshot: 'screenshot olishga' };
const when = (d) => new Date(d).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' });
const select = 'bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none';
const sum = (rows) => rows.reduce((total, r) => total + r.count, 0);

// Savol turgan joyga havola
const itemHref = (v) => v.source === 'train' ? `/train/${v.itemId}`
    : v.source === 'exam' ? '/exam/manage'
    : `/quiz/${encodeURIComponent(v.context)}`;

export default function ViolationsPage() {
    const [rows, setRows] = useState(null);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [type, setType] = useState('all');
    const [source, setSource] = useState('all');
    const [student, setStudent] = useState('all');

    const load = () => fetch('/api/violations')
        .then(async (res) => {
            const d = await res.json();
            if (!res.ok) throw new Error(res.status === 403 ? 'Bu sahifa faqat admin uchun' : d.message);
            setRows(d.violations);
            setError('');
        })
        .catch((e) => setError(e.message || "Yuklab bo'lmadi"));
    useEffect(() => { load(); }, []);

    const all = rows || [];
    const list = all.filter((v) =>
        (type === 'all' || v.type === type) &&
        (source === 'all' || v.source === source) &&
        (student === 'all' || v.username === student) &&
        (!query.trim() || `${v.username} ${v.title} ${v.context}`.toLowerCase().includes(query.trim().toLowerCase())));
    const { pageItems, pager, reset } = usePagination(list, 15);

    // Eng ko'p urinish qilgan o'quvchilar yuqorida
    const students = Object.entries(all.reduce((m, v) => ({ ...m, [v.username]: (m[v.username] || 0) + v.count }), {}))
        .sort((a, b) => b[1] - a[1]);

    const filter = (set) => (value) => { set(value); reset(); };

    const remove = async (queryString, question) => {
        if (!window.confirm(question)) return;
        const res = await fetch(`/api/violations?${queryString}`, { method: 'DELETE' }).catch(() => null);
        if (!res?.ok) return setError("O'chirib bo'lmadi");
        if (queryString.startsWith('username=')) setStudent('all');
        load();
    };

    if (error && !rows) return <p className="text-center text-red-400 py-20 text-sm">{error}</p>;

    const cards = [
        [ShieldAlert, 'Jami urinish', sum(all), 'text-red-400'],
        [Camera, 'Screenshot', sum(all.filter((v) => v.type === 'screenshot')), 'text-orange-400'],
        [Copy, 'Nusxalash', sum(all.filter((v) => v.type === 'copy')), 'text-yellow-400'],
        [Users, "O'quvchilar", students.length, 'text-blue-400'],
    ];

    return (
        <div className="min-h-screen bg-gray-950 p-[10px] space-y-[10px]">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-900/30 border border-red-800/50 flex items-center justify-center">
                    <ShieldAlert size={18} className="text-red-400" />
                </div>
                <div className="flex-1">
                    <h1 className="text-xl font-extrabold text-white">Qoida buzarliklar</h1>
                    <p className="text-xs text-gray-500">O&apos;quvchilarga bu haqda xabar ko&apos;rsatilmaydi (imtihondagi qulflashdan tashqari)</p>
                </div>
                <button onClick={load} title="Yangilash" className="p-2 rounded-lg border border-gray-800 text-gray-400 hover:text-white">
                    <RefreshCw size={15} />
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">
                {cards.map(([Icon, label, value, color]) => (
                    <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                        <p className="flex items-center gap-1.5 text-xs text-gray-500"><Icon size={13} className={color} /> {label}</p>
                        <p className="text-2xl font-bold text-white mt-1">{rows ? value : '—'}</p>
                    </div>
                ))}
            </div>

            <p className="text-[11px] text-gray-600">
                Brauzer hamma urinishni sezmaydi: telefonda tugmalar bilan olingan screenshot va ekranni suratga olish qayd qilinmaydi.
                &quot;Win+Shift&quot; va &quot;gumon&quot; deb belgilangan yozuvlar aniq dalil emas. Qaror qabul qilishdan oldin shuni hisobga oling.
            </p>

            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input value={query} onChange={(e) => filter(setQuery)(e.target.value)} placeholder="O'quvchi yoki savol…" className={`${select} w-full pl-9`} />
                </div>
                <select value={student} onChange={(e) => filter(setStudent)(e.target.value)} className={select} aria-label="O'quvchi">
                    <option value="all">Barcha o&apos;quvchilar</option>
                    {students.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
                </select>
                <select value={type} onChange={(e) => filter(setType)(e.target.value)} className={select} aria-label="Turi">
                    <option value="all">Barcha turlar</option>
                    {Object.entries(VIOLATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={source} onChange={(e) => filter(setSource)(e.target.value)} className={select} aria-label="Bo'lim">
                    <option value="all">Barcha bo&apos;limlar</option>
                    {Object.entries(VIOLATION_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {student !== 'all' && (
                    <button onClick={() => remove(`username=${encodeURIComponent(student)}`, `${student}ning hamma yozuvlari o'chirilsinmi?`)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-900 text-xs text-red-400 hover:bg-red-900/20">
                        <Trash2 size={13} /> Tozalash
                    </button>
                )}
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            {!rows ? (
                <div className="h-24 rounded-xl bg-gray-900 animate-pulse" />
            ) : list.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-16">{all.length ? 'Mos yozuv topilmadi' : "Hozircha qoida buzarlik yo'q"}</p>
            ) : (
                <div className="space-y-2">
                    {pageItems.map((v) => (
                        <div key={v._id} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3.5">
                            <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${v.type === 'screenshot' ? 'bg-orange-900/30 text-orange-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                                {v.type === 'screenshot' ? <Camera size={16} /> : <Copy size={16} />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-300">
                                    <button onClick={() => filter(setStudent)(v.username)} className="font-bold text-white hover:underline">{v.username}</button>
                                    {' '}shu savolda {ACTION[v.type]} <b className="text-red-400">{v.count} marta</b> urindi
                                </p>
                                <Link href={itemHref(v)} className="block text-sm text-green-300 hover:underline line-clamp-2 break-words">{v.title}</Link>
                                <p className="text-[11px] text-gray-600 mt-1">
                                    {VIOLATION_SOURCES[v.source]}{v.context && ` · ${v.context}`}
                                    {' · '}{(v.methods || []).map((m) => VIOLATION_METHODS[m] || m).join(', ')}
                                    {' · '}oxirgisi {when(v.lastAt)}{v.count > 1 && `, birinchisi ${when(v.firstAt)}`}
                                </p>
                            </div>
                            <span className="shrink-0 min-w-[40px] text-center text-sm font-bold text-red-300 bg-red-900/30 border border-red-900 rounded-lg px-2 py-1">×{v.count}</span>
                            <button onClick={() => remove(`id=${encodeURIComponent(v._id)}`, "Bu yozuv o'chirilsinmi?")} title="O'chirish"
                                className="shrink-0 p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-gray-800">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <AdminPagination {...pager} />
        </div>
    );
}

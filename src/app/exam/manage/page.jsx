"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus, Trash2, Pencil, Save, ArrowLeft, BarChart3, Code2, ListChecks, Clock, Trophy,
    AlertCircle, CheckCircle2, RotateCcw, Eye, EyeOff,
} from 'lucide-react';
import ExamResultsAdmin from '../../../components/ExamResultsAdmin';

const emptyTest = () => ({ type: 'test', text: '', points: 1, options: ['', '', '', ''], correctAnswer: 0 });
const STARTER = {
    javascript: '// Kodni shu yerga yozing\nconsole.log("Salom");\n',
    python: '# Kodni shu yerga yozing\nprint("Salom")\n',
};
const emptyCode = () => ({
    type: 'code', text: '', points: 5, language: 'javascript',
    starterCode: STARTER.javascript,
});
const emptyExam = () => ({ title: '', description: '', durationMinutes: 60, isActive: false, questions: [emptyTest()] });

// DB -> forma / forma -> API (amaliy savolda funksiya va test-case yo'q)
const toForm = (e) => e;
const toPayload = (f) => f;

const inp = 'w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-green-600';

// Talabaning javoblari + amaliy masalalarga qo'lda ball qo'yish
function AttemptAnswers({ a, exam, say, onSaved }) {
    const codeQs = exam.questions.filter(q => q.type === 'code');
    const [grades, setGrades] = useState(() =>
        Object.fromEntries(codeQs.map(q => [q._id, a.answers?.[q._id]?.graded ? String(a.answers[q._id].earned) : ''])));
    const [saving, setSaving] = useState(false);

    const saveGrades = async () => {
        setSaving(true);
        try {
            const r = await fetch(`/api/exams/${a.exam}/attempt/grade`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: a.username, grades }),
            });
            const d = await r.json();
            if (!r.ok) { say('error', d.message || 'Xato'); return; }
            say('success', 'Ballar saqlandi');
            onSaved();
        } catch { say('error', 'Internet xatosi'); }
        finally { setSaving(false); }
    };

    return (
        <div className="px-4 pb-4 space-y-2">
            {exam.questions.map((q, i) => {
                const r = a.answers?.[q._id];
                return (
                    <div key={q._id} className="bg-gray-800/50 rounded-xl p-3 text-xs">
                        <p className="text-gray-300 mb-1"><b>{i + 1}.</b> {q.text}</p>
                        {q.type === 'test' ? (
                            <p className={r?.earned > 0 ? 'text-green-400' : 'text-red-400'}>
                                Javob: {r?.choice != null ? q.options[r.choice] : '—'} · to&apos;g&apos;ri: {q.options[q.correctAnswer]} · {r?.earned ?? 0}/{q.points}
                            </p>
                        ) : (
                            <>
                                <p className="text-purple-300 mb-1">{q.language === 'python' ? 'Python' : 'JavaScript'}</p>
                                <pre className="bg-gray-950 text-green-300 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap max-h-72">{r?.code?.trim() ? r.code : "(bo'sh)"}</pre>
                                <label className="flex items-center gap-2 mt-2 text-gray-300">
                                    Ball:
                                    <input type="number" min={0} max={q.points} step="0.5" value={grades[q._id] ?? ''}
                                        onChange={e => setGrades(g => ({ ...g, [q._id]: e.target.value }))}
                                        className="w-20 bg-gray-900 border border-gray-700 text-white rounded-lg px-2 py-1 focus:outline-none focus:border-green-600" />
                                    / {q.points}
                                    {!r?.graded && <span className="text-yellow-400">· baholanmagan</span>}
                                </label>
                            </>
                        )}
                    </div>
                );
            })}
            {codeQs.length > 0 && (
                <button onClick={saveGrades} disabled={saving}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-sm">
                    <Save size={14} /> {saving ? 'Saqlanmoqda…' : 'Ballarni saqlash'}
                </button>
            )}
        </div>
    );
}

export default function ExamManagePage() {
    const router = useRouter();
    const [ok, setOk] = useState(false);
    const [exams, setExams] = useState([]);
    const [view, setView] = useState('list'); // list | edit | results
    const [form, setForm] = useState(null);
    const [editId, setEditId] = useState(null);
    const [results, setResults] = useState({ exam: null, attempts: [] });
    const [openAttempt, setOpenAttempt] = useState(null);
    const [toast, setToast] = useState(null);
    const [saving, setSaving] = useState(false);

    const say = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };
    const load = () => fetch('/api/exams').then(r => r.json()).then(d => setExams(d.exams || []));

    useEffect(() => {
        fetch('/api/auth/me').then(r => r.json()).then(d => {
            if (d?.user?.username !== 'username') { router.push('/exam'); return; }
            setOk(true); load();
        }).catch(() => router.push('/exam'));
    }, [router]);

    const openEdit = async (id) => {
        if (!id) { setForm(emptyExam()); setEditId(null); setView('edit'); return; }
        const d = await fetch(`/api/exams/${id}`).then(r => r.json());
        setForm(toForm(d.exam)); setEditId(id); setView('edit');
    };

    const save = async () => {
        let payload;
        try { payload = toPayload(form); } catch (e) { say('error', e.message); return; }
        setSaving(true);
        try {
            const r = await fetch(editId ? `/api/exams/${editId}` : '/api/exams', {
                method: editId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const d = await r.json();
            if (!r.ok) { say('error', d.message || 'Xato'); return; }
            say('success', 'Saqlandi'); await load(); setView('list');
        } catch { say('error', 'Internet xatosi'); }
        finally { setSaving(false); }
    };

    const togglePublish = async (e) => {
        const r = await fetch(`/api/exams/${e._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !e.isActive }),
        });
        if (!r.ok) { say('error', 'Xato'); return; }
        say('success', e.isActive ? 'Talabalardan yashirildi' : 'Talabalarga ochildi');
        load();
    };

    const del = async (e) => {
        if (!confirm(`"${e.title}" imtihoni va barcha natijalari o'chiriladi. Davom etasizmi?`)) return;
        await fetch(`/api/exams/${e._id}`, { method: 'DELETE' });
        load();
    };

    const openResults = async (e) => {
        const d = await fetch(`/api/exams/${e._id}/attempt`).then(r => r.json());
        const full = await fetch(`/api/exams/${e._id}`).then(r => r.json());
        setResults({ exam: full.exam, attempts: (d.attempts || []).filter(a => a.username !== 'username') });
        setOpenAttempt(null); setView('results');
    };

    const allowRetake = async (a) => {
        if (!confirm(`${a.username} qayta topshirishiga ruxsat berasizmi? Hozirgi natija o'chadi.`)) return;
        await fetch(`/api/exams/${a.exam}/attempt?username=${encodeURIComponent(a.username)}`, { method: 'DELETE' });
        openResults(results.exam);
    };

    // forma yordamchilari
    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const setQ = (i, patch) => setForm(f => ({ ...f, questions: f.questions.map((q, j) => j === i ? { ...q, ...patch } : q) }));
    const delQ = (i) => setForm(f => ({ ...f, questions: f.questions.filter((_, j) => j !== i) }));

    if (!ok) return <div className="min-h-screen bg-gray-950" />;

    const totalPoints = form?.questions.reduce((s, q) => s + (Number(q.points) || 0), 0) || 0;

    return (
        <div className="min-h-screen bg-gray-950 p-4 sm:p-6">
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl border shadow-2xl text-sm font-semibold ${toast.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-300' : 'bg-red-900/90 border-red-700 text-red-300'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
                </div>
            )}

            {/* ── RO'YXAT ── */}
            {view === 'list' && (
                <>
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-white">Exam Management</h1>
                        <button onClick={() => openEdit(null)} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-xl text-sm">
                            <Plus size={15} /> New exam
                        </button>
                    </div>
                    {exams.length === 0 && <p className="text-gray-500 text-sm text-center py-20">Hali imtihon yaratilmagan</p>}
                    <div className="space-y-3">
                        {exams.map(e => (
                            <div key={e._id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
                                <div className="flex-1 min-w-[200px]">
                                    <p className="text-white font-bold flex items-center gap-2">
                                        {e.title}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-lg border ${e.isActive ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>{e.isActive ? 'Published' : 'Draft'}</span>
                                    </p>
                                    <p className="text-xs text-gray-500 flex flex-wrap gap-3 mt-1">
                                        <span className="flex items-center gap-1"><Clock size={11} /> {e.durationMinutes} daq</span>
                                        <span className="flex items-center gap-1"><ListChecks size={11} /> {e.questionCount - e.codeCount} test</span>
                                        <span className="flex items-center gap-1"><Code2 size={11} /> {e.codeCount} amaliy</span>
                                        <span className="flex items-center gap-1"><Trophy size={11} /> {e.totalPoints} ball</span>
                                    </p>
                                </div>
                                <button onClick={() => togglePublish(e)}
                                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border ${e.isActive ? 'border-yellow-800 text-yellow-400 hover:bg-yellow-900/20' : 'border-green-700 text-green-400 hover:bg-green-900/20'}`}>
                                    {e.isActive ? <EyeOff size={14} /> : <Eye size={14} />} {e.isActive ? 'Unpublish' : 'Publish'}
                                </button>
                                <button onClick={() => openResults(e)} className="flex items-center gap-1.5 text-sm text-blue-300 border border-gray-700 hover:border-blue-500 px-3 py-1.5 rounded-xl"><BarChart3 size={14} /> Natijalar</button>
                                <button onClick={() => openEdit(e._id)} className="flex items-center gap-1.5 text-sm text-gray-300 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-xl"><Pencil size={14} /> Tahrirlash</button>
                                <button onClick={() => del(e)} className="flex items-center gap-1.5 text-sm text-red-400 border border-red-900 hover:bg-red-900/30 px-3 py-1.5 rounded-xl"><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ── TAHRIRLASH ── */}
            {view === 'edit' && form && (
                <div className="max-w-3xl mx-auto">
                    <button onClick={() => setView('list')} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-4"><ArrowLeft size={15} /> Orqaga</button>
                    <h1 className="text-xl font-extrabold text-white mb-5">{editId ? 'Edit exam' : 'New exam'}</h1>

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3 mb-5">
                        <input className={inp} placeholder="Imtihon nomi" value={form.title} onChange={e => setF('title', e.target.value)} />
                        <textarea className={inp + ' resize-none'} rows={2} placeholder="Tavsif (ixtiyoriy)" value={form.description} onChange={e => setF('description', e.target.value)} />
                        <div className="flex flex-wrap items-end gap-4">
                            <label className="text-xs text-gray-400 uppercase font-semibold">Jami vaqt (daqiqa)
                                <input type="number" min={1} className={inp + ' mt-1 w-32'} value={form.durationMinutes} onChange={e => setF('durationMinutes', Number(e.target.value))} />
                            </label>
                            <button type="button" onClick={() => setF('isActive', !form.isActive)}
                                className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border ${form.isActive ? 'border-green-700 text-green-400 bg-green-900/20' : 'border-gray-700 text-gray-400'}`}>
                                {form.isActive ? <Eye size={14} /> : <EyeOff size={14} />} {form.isActive ? 'Published (students can see it)' : 'Draft (hidden from students)'}
                            </button>
                            <span className="ml-auto text-sm text-gray-400">Jami: <b className="text-yellow-400">{totalPoints}</b> ball</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {form.questions.map((q, i) => (
                            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                                    <div className="flex rounded-xl overflow-hidden border border-gray-700 text-xs font-semibold">
                                        <button type="button" onClick={() => q.type !== 'test' && setQ(i, { ...emptyTest(), text: q.text, points: q.points })}
                                            className={`px-3 py-1.5 ${q.type === 'test' ? 'bg-green-900/40 text-green-400' : 'text-gray-500'}`}>Test</button>
                                        <button type="button" onClick={() => q.type !== 'code' && setQ(i, { ...emptyCode(), text: q.text, points: q.points })}
                                            className={`px-3 py-1.5 ${q.type === 'code' ? 'bg-purple-900/40 text-purple-300' : 'text-gray-500'}`}>Amaliy (kod)</button>
                                    </div>
                                    <label className="ml-auto text-xs text-gray-400 flex items-center gap-1.5">Ball
                                        <input type="number" min={0} step="0.5" className={inp + ' w-20'} value={q.points} onChange={e => setQ(i, { points: Number(e.target.value) })} />
                                    </label>
                                    <button type="button" onClick={() => delQ(i)} disabled={form.questions.length === 1} className="text-red-400 disabled:opacity-30 p-1.5"><Trash2 size={15} /></button>
                                </div>

                                <textarea className={inp + ' resize-none'} rows={3} placeholder="Savol matni" value={q.text} onChange={e => setQ(i, { text: e.target.value })} />

                                {q.type === 'test' ? (
                                    <div className="space-y-2">
                                        {q.options.map((o, j) => (
                                            <div key={j} className="flex items-center gap-2">
                                                <button type="button" onClick={() => setQ(i, { correctAnswer: j })}
                                                    className={`w-8 h-8 shrink-0 rounded-lg border-2 text-xs font-bold ${q.correctAnswer === j ? 'border-green-500 bg-green-500 text-white' : 'border-gray-700 text-gray-500'}`}>
                                                    {'ABCDEF'[j]}
                                                </button>
                                                <input className={inp} placeholder={`${'ABCDEF'[j]} variant`} value={o}
                                                    onChange={e => setQ(i, { options: q.options.map((x, k) => k === j ? e.target.value : x) })} />
                                                {q.options.length > 2 && (
                                                    <button type="button" className="text-gray-600 hover:text-red-400"
                                                        onClick={() => setQ(i, { options: q.options.filter((_, k) => k !== j), correctAnswer: Math.min(q.correctAnswer, q.options.length - 2) })}><Trash2 size={13} /></button>
                                                )}
                                            </div>
                                        ))}
                                        {q.options.length < 6 && (
                                            <button type="button" onClick={() => setQ(i, { options: [...q.options, ''] })} className="text-xs text-green-400 hover:underline">+ variant qo&apos;shish</button>
                                        )}
                                        <p className="text-[11px] text-gray-600">To&apos;g&apos;ri javobni harfni bosib belgilang.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <label className="text-xs text-gray-400 block">Dasturlash tili
                                            <select className={inp + ' mt-1'} value={q.language || 'javascript'}
                                                onChange={e => {
                                                    const language = e.target.value;
                                                    const untouched = !q.starterCode || q.starterCode === STARTER.javascript || q.starterCode === STARTER.python;
                                                    setQ(i, { language, ...(untouched ? { starterCode: STARTER[language] } : {}) });
                                                }}>
                                                <option value="javascript">JavaScript</option>
                                                <option value="python">Python</option>
                                            </select>
                                        </label>
                                        <label className="text-xs text-gray-400 block">Boshlang'ich kod (ixtiyoriy, talabaga ko'rinadi)
                                            <textarea className={inp + ' mt-1 font-mono resize-y'} rows={5} value={q.starterCode} onChange={e => setQ(i, { starterCode: e.target.value })} />
                                        </label>
                                        <p className="text-[11px] text-gray-600">Amaliy masalaga ballni natijalar sahifasida kodni ko'rib o'zingiz qo'yasiz.</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setF('questions', [...form.questions, emptyTest()])} className="flex items-center gap-1.5 border border-gray-700 text-gray-300 hover:border-green-600 px-4 py-2.5 rounded-xl text-sm"><ListChecks size={14} /> Test qo&apos;shish</button>
                        <button onClick={() => setF('questions', [...form.questions, emptyCode()])} className="flex items-center gap-1.5 border border-gray-700 text-gray-300 hover:border-purple-500 px-4 py-2.5 rounded-xl text-sm"><Code2 size={14} /> Amaliy qo&apos;shish</button>
                        <button onClick={save} disabled={saving} className="ml-auto flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm"><Save size={14} /> {saving ? 'Saqlanmoqda…' : 'Saqlash'}</button>
                    </div>
                </div>
            )}

            {/* ── NATIJALAR ── */}
            {view === 'results' && results.exam && (
                                <div className="max-w-5xl mx-auto">
                    <button onClick={() => setView('list')} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-4"><ArrowLeft size={15} /> Orqaga</button>
                    <h1 className="text-xl font-extrabold text-white mb-1">{results.exam.title}: natijalar</h1>
                    <p className="text-gray-500 text-sm mb-5">{results.attempts.length} ta urinish</p>
                    <ExamResultsAdmin
                        exam={results.exam}
                        attempts={results.attempts}
                        openId={openAttempt}
                        setOpenId={setOpenAttempt}
                        onRetake={allowRetake}
                        renderAnswers={(a) => <AttemptAnswers a={a} exam={results.exam} say={say} onSaved={() => openResults(results.exam)} />}
                    />
                </div>
            )}
        </div>
    );
}

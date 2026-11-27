'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import TrainLock from '../../../components/trainLock';
import { DIFFICULTY, LANGUAGES, CREATE_LEVEL, IDENTIFIER, MAX_TESTS } from '../../../lib/train';

const inputCls = 'w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-green-600';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5';

const newTest = (hidden) => ({ key: Math.random().toString(36).slice(2), args: '', expected: '', hidden });

export default function NewTrainProblemPage() {
    const router = useRouter();
    const [access, setAccess] = useState(null);
    const [form, setForm] = useState({
        title: '', description: '', difficulty: 'Easy',
        languages: ['javascript', 'python'], functionName: '', params: '',
    });
    const [tests, setTests] = useState(() => [newTest(false), newTest(true)]);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Ruxsatni server hal qiladi — bu yerda faqat mos ekran ko'rsatiladi
    useEffect(() => {
        fetch('/api/train/problems')
            .then(async (res) => {
                const d = await res.json();
                if (d.locked) setAccess({ locked: d });
                else if (!res.ok) setAccess({ error: d.message || 'Xatolik yuz berdi' });
                else if (d.canCreate) setAccess({ ok: true });
                else {
                    const me = await fetch('/api/auth/me').then(r => r.json());
                    setAccess({ noCreate: { level: d.level, xp: me.user?.xp || 0 } });
                }
            })
            .catch(() => setAccess({ error: "Serverga ulanib bo'lmadi" }));
    }, []);

    if (!access) return (
        <div className="flex items-center justify-center min-h-screen bg-gray-950">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
    if (access.locked) return <TrainLock level={access.locked.level} xp={access.locked.xp} />;
    if (access.noCreate) return <TrainLock {...access.noCreate} required={CREATE_LEVEL} title="Masala qo'shish yopiq" />;
    if (access.error) return <p className="text-center text-red-400 py-20 text-sm">{access.error}</p>;

    const set = (field, value) => setForm(f => ({ ...f, [field]: value }));
    const setTest = (key, patch) => setTests(list => list.map(t => t.key === key ? { ...t, ...patch } : t));
    const toggleLanguage = (l) => set('languages', form.languages.includes(l)
        ? form.languages.filter(x => x !== l)
        : [...form.languages, l]);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        const params = form.params.split(',').map(p => p.trim()).filter(Boolean);
        if (!IDENTIFIER.test(form.functionName)) return setError("Funksiya nomi noto'g'ri (lotin harfi, raqam va _)");
        if (!params.every(p => IDENTIFIER.test(p))) return setError("Parametr nomlari noto'g'ri");

        const testCases = [];
        for (let i = 0; i < tests.length; i++) {
            let args, expected;
            try { args = JSON.parse(`[${tests[i].args}]`); }
            catch { return setError(`${i + 1}-test: argumentlar noto'g'ri yozilgan`); }
            try { expected = JSON.parse(tests[i].expected); }
            catch { return setError(`${i + 1}-test: kutilgan javob noto'g'ri yozilgan`); }
            if (args.length !== params.length) return setError(`${i + 1}-test: ${params.length} ta argument bo'lishi kerak`);
            testCases.push({ args, expected, hidden: tests[i].hidden });
        }

        setSaving(true);
        try {
            const res = await fetch('/api/train/problems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, params, testCases }),
            });
            const d = await res.json();
            if (res.ok) return router.push(`/train/${d.id}`);
            setError(d.message || 'Xatolik yuz berdi');
        } catch {
            setError("Serverga ulanib bo'lmadi");
        }
        setSaving(false);
    };

    return (
        <div className="min-h-screen bg-gray-950 p-[10px]">
            <form onSubmit={submit} className="space-y-[10px]">
                <Link href="/train" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
                    <ArrowLeft size={14} /> Masalalar
                </Link>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Yangi masala</h1>

                <div className="grid lg:grid-cols-2 gap-[10px] items-start">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                    <div>
                        <label className={labelCls}>Sarlavha</label>
                        <input required maxLength={120} value={form.title} onChange={e => set('title', e.target.value)}
                            placeholder="Ikki son yig'indisi" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Masala sharti</label>
                        <textarea required rows={12} maxLength={5000} value={form.description} onChange={e => set('description', e.target.value)}
                            placeholder="Funksiya nima qabul qiladi va nima qaytarishi kerak, cheklovlar…" className={inputCls} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Qiyinlik</label>
                            <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)} className={inputCls}>
                                {Object.entries(DIFFICULTY).map(([k, v]) => <option key={k} value={k}>{v.label} (+{v.xp} XP)</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Dasturlash tillari</label>
                            <div className="flex gap-2">
                                {Object.entries(LANGUAGES).map(([k, v]) => (
                                    <button type="button" key={k} onClick={() => toggleLanguage(k)}
                                        className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${form.languages.includes(k) ? 'border-green-600 bg-green-900/30 text-green-400' : 'border-gray-800 text-gray-500'}`}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Funksiya nomi</label>
                            <input required value={form.functionName} onChange={e => set('functionName', e.target.value.trim())}
                                placeholder="sum" className={`${inputCls} font-mono`} />
                        </div>
                        <div>
                            <label className={labelCls}>Parametrlar (vergul bilan)</label>
                            <input value={form.params} onChange={e => set('params', e.target.value)}
                                placeholder="a, b" className={`${inputCls} font-mono`} />
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
                    <div>
                        <p className="text-white font-semibold text-sm">Test-case&apos;lar</p>
                        <p className="text-xs text-gray-500 mt-1">
                            Qiymatlar JSON ko&apos;rinishida yoziladi: <code className="text-gray-300">true</code>, <code className="text-gray-300">null</code>, matn qo&apos;shtirnoqda <code className="text-gray-300">&quot;salom&quot;</code>.
                            Argumentlar vergul bilan: <code className="text-gray-300">[2, 7, 11], 9</code>.
                            Kamida 1 ta ochiq va 1 ta yashirin test kerak.
                        </p>
                    </div>
                    {tests.map((t, i) => (
                        <div key={t.key} className="flex flex-wrap items-center gap-2">
                            <span className="w-5 text-xs text-gray-600">{i + 1}</span>
                            <input required={!!form.params.trim()} value={t.args} onChange={e => setTest(t.key, { args: e.target.value })}
                                placeholder="Argumentlar: 2, 3" className={`${inputCls} font-mono flex-[2] min-w-[140px] w-auto`} />
                            <input required value={t.expected} onChange={e => setTest(t.key, { expected: e.target.value })}
                                placeholder="Javob: 5" className={`${inputCls} font-mono flex-1 min-w-[100px] w-auto`} />
                            <button type="button" onClick={() => setTest(t.key, { hidden: !t.hidden })}
                                className={`flex items-center gap-1.5 w-28 justify-center py-2.5 rounded-xl border text-xs ${t.hidden ? 'border-purple-800 text-purple-300' : 'border-green-800 text-green-400'}`}>
                                {t.hidden ? <><EyeOff size={13} /> Yashirin</> : <><Eye size={13} /> Ochiq</>}
                            </button>
                            <button type="button" onClick={() => setTests(list => list.filter(x => x.key !== t.key))}
                                disabled={tests.length <= 2} className="p-2 text-gray-600 hover:text-red-400 disabled:opacity-30">
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}
                    <button type="button" onClick={() => setTests(list => [...list, newTest(true)])} disabled={tests.length >= MAX_TESTS}
                        className="flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 disabled:opacity-40">
                        <Plus size={14} /> Test qo&apos;shish
                    </button>
                </div>
                </div>

                {error && <p className="text-sm text-red-400 bg-red-900/20 border border-red-900 rounded-xl p-3">{error}</p>}

                <button type="submit" disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl">
                    {saving && <Loader2 size={15} className="animate-spin" />} Masalani e&apos;lon qilish
                </button>
            </form>
        </div>
    );
}

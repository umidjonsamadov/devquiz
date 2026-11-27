'use client';

import { useState, useEffect } from 'react';
import { SquareCheck, Loader2 } from 'lucide-react';

function Field({ label, children, cls = 'text-gray-200' }) {
    return (
        <div>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <pre className={`rounded-lg bg-gray-800 px-3 py-2 font-mono text-[13px] whitespace-pre-wrap break-words ${cls}`}>{children}</pre>
        </div>
    );
}

/**
 * Namuna testlar va Run natijasi.
 * result: null (hali ishlatilmagan) | { passed, total, results, error }
 */
export default function TrainTestPanel({ samples, params, running, result }) {
    const [selected, setSelected] = useState(0);

    // Yangi natija kelganda birinchi o'tmagan testni ochamiz
    useEffect(() => {
        if (!result) return;
        setSelected(Math.max(0, result.results.findIndex(r => !r.ok)));
    }, [result]);

    const index = Math.min(selected, samples.length - 1);
    const test = samples[index];
    const outcome = result?.results[index];
    const allPassed = result && result.passed === result.total;

    return (
        <div className="h-full flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="h-10 shrink-0 flex items-center gap-2 px-3 bg-gray-800/60 border-b border-gray-800">
                <SquareCheck size={14} className="text-green-400" />
                <span className="text-xs font-semibold text-white">Testlar</span>
                <span className="ml-auto text-[11px] text-gray-500 hidden sm:block">Ctrl+Enter — Run</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3" aria-live="polite">
                {running ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                        <Loader2 size={16} className="animate-spin text-green-400" /> Testlar ishlayapti…
                    </div>
                ) : (
                    <>
                        {result && (
                            <div className="flex flex-wrap items-baseline gap-x-3">
                                <p className={`text-base font-bold ${allPassed ? 'text-teal-400' : 'text-red-400'}`}>
                                    {allPassed ? "Namuna testlar o'tdi" : result.error ? 'Xatolik' : "Noto'g'ri javob"}
                                </p>
                                <p className="text-xs text-gray-500">{result.passed}/{result.total}</p>
                                {allPassed && <p className="text-xs text-gray-500">Yakuniy tekshirish uchun «Yuborish»ni bosing</p>}
                            </div>
                        )}
                        {result?.error && (
                            <pre className="rounded-lg bg-red-900/20 border border-red-900 px-3 py-2 text-xs text-red-300 whitespace-pre-wrap break-words">{result.error}</pre>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {samples.map((_, i) => {
                                const r = result?.results[i];
                                return (
                                    <button key={i} onClick={() => setSelected(i)} aria-pressed={i === index}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${i === index ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                                        {r && <span className={r.ok ? 'text-teal-400' : 'text-red-400'}>{r.ok ? '✓' : '✗'}</span>}
                                        Test {i + 1}
                                    </button>
                                );
                            })}
                        </div>

                        {test && (
                            <>
                                <Field label="Kirish">
                                    {test.args.map((a, i) => `${params[i]} = ${JSON.stringify(a)}`).join('\n') || '—'}
                                </Field>
                                {outcome && (
                                    <Field label="Sizning javobingiz" cls={outcome.ok ? 'text-teal-300' : 'text-red-300'}>
                                        {outcome.got ?? 'undefined'}
                                    </Field>
                                )}
                                <Field label="Kutilgan javob">{JSON.stringify(test.expected)}</Field>
                                {outcome?.logs?.length > 0 && (
                                    <Field label="Konsol (console.log / print)">
                                        {outcome.logs.map((l, i) => (
                                            <span key={i} className={`block ${l.stream === 'err' ? 'text-red-400' : ''}`}>{l.text}</span>
                                        ))}
                                    </Field>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

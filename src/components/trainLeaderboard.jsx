'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DIFFICULTY } from '../lib/train';

const PER_PAGE = 10;
const BAR_CELLS = 20;
const COMMAND = 'train leaderboard --sort=points --desc';
const MONO = { fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace" };

// GitHub Dark sintaksis ranglari
const C = {
    comment: 'text-[#8b949e]',
    keyword: 'text-[#ff7b72]',
    string:  'text-[#a5d6ff]',
    number:  'text-[#79c0ff]',
    func:    'text-[#d2a8ff]',
    prop:    'text-[#7ee787]',
    plain:   'text-[#c9d1d9]',
};
const LEVEL_COLOR = { Easy: 'text-[#3fb950]', Medium: 'text-[#d29922]', Hard: 'text-[#f85149]' };

const ROW = 'grid items-center gap-x-3 pr-3 sm:pr-4 grid-cols-[40px_36px_minmax(0,1fr)_64px] md:grid-cols-[48px_44px_minmax(0,1fr)_44px_44px_44px_72px] 2xl:grid-cols-[48px_44px_minmax(0,1fr)_44px_44px_44px_220px_72px]';

// Satr yozilayotgandek chiqadi
function useTyping(text, speed = 22) {
    const [length, setLength] = useState(0);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setLength(text.length); return; }
        const timer = setInterval(() => setLength(n => {
            if (n >= text.length) clearInterval(timer);
            return Math.min(text.length, n + 1);
        }), speed);
        return () => clearInterval(timer);
    }, [text, speed]);
    return { typed: text.slice(0, length), done: length >= text.length };
}

const Cursor = () => <span aria-hidden className="inline-block w-[0.6em] h-[1.1em] align-text-bottom bg-[#3fb950] animate-pulse" />;

function Prompt({ children }) {
    return (
        <p className="break-all">
            <span className="text-[#3fb950] font-bold">dev@quiz</span>
            <span className={C.plain}>:</span>
            <span className="text-[#58a6ff] font-bold">~/train</span>
            <span className={C.plain}>$ </span>
            <span className="text-white">{children}</span>
        </p>
    );
}

// Qiymatni turiga qarab bo'yaydi
function Value({ value }) {
    if (value === null) return <span className={C.number}>null</span>;
    return typeof value === 'number'
        ? <span className={C.number}>{value}</span>
        : <span className={C.string}>&quot;{value}&quot;</span>;
}

// Ball nisbati: [██████░░░░]
function AsciiBar({ points, max }) {
    const filled = Math.max(1, Math.round((points / max) * BAR_CELLS));
    return (
        <span aria-hidden className="hidden 2xl:block whitespace-pre text-[13px]">
            <span className={C.comment}>[</span>
            <span className="text-[#3fb950]">{'█'.repeat(filled)}</span>
            <span className="text-[#30363d]">{'░'.repeat(BAR_CELLS - filled)}</span>
            <span className={C.comment}>]</span>
        </span>
    );
}

// Qator bosilganda ochiladigan JSON
function UserJson({ row, max }) {
    const fields = [
        ['username', row.username],
        ['rank', row.rank],
        ['level', row.level],
        ['points', row.points],
        ['solved', row.solved],
    ];
    return (
        <div className="ml-10 md:ml-12 mr-3 mb-2 border-l-2 border-[#30363d] pl-4 py-2 text-xs leading-6 overflow-x-auto">
            <Prompt>cat users/{row.username}.json</Prompt>
            <p className={C.plain}>{'{'}</p>
            {fields.map(([key, value]) => (
                <p key={key} className="pl-4 whitespace-nowrap">
                    <span className={C.prop}>&quot;{key}&quot;</span><span className={C.plain}>: </span>
                    <Value value={value} /><span className={C.plain}>,</span>
                </p>
            ))}
            <p className="pl-4">
                <span className={C.prop}>&quot;difficulty&quot;</span><span className={C.plain}>{': { '}</span>
                {Object.keys(DIFFICULTY).map((k, i) => (
                    <span key={k} className="whitespace-nowrap">
                        {i > 0 && <span className={C.plain}>, </span>}
                        <span className={C.prop}>&quot;{k.toLowerCase()}&quot;</span><span className={C.plain}>: </span><Value value={row[k]} />
                    </span>
                ))}
                <span className={C.plain}>{' },'}</span>
            </p>
            <p className="pl-4">
                <span className={C.prop}>&quot;ofLeader&quot;</span><span className={C.plain}>: </span>
                <Value value={`${Math.round((row.points / max) * 100)}%`} />
            </p>
            <p className={C.plain}>{'}'}</p>
        </div>
    );
}

function Line({ row, line, max, isYou, open, onToggle }) {
    return (
        <li className={isYou ? 'bg-[#388bfd]/10 shadow-[inset_2px_0_0_#58a6ff]' : ''}>
            <button onClick={onToggle} aria-expanded={open} className={`${ROW} w-full py-1.5 text-left hover:bg-[#161b22] focus-visible:bg-[#161b22] outline-none`}>
                <span aria-hidden className="text-right pr-1 text-xs text-[#484f58] select-none">{line}</span>
                <span className={`font-bold ${C.comment}`}>{String(row.rank).padStart(2, '0')}</span>
                <span className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 w-6 h-6 rounded overflow-hidden bg-[#21262d] flex items-center justify-center text-[11px] font-bold text-white">
                        {row.avatarUrl
                            ? <img src={row.avatarUrl} alt="" className="w-full h-full object-cover" />
                            : row.username.charAt(0).toUpperCase()}
                    </span>
                    <span className={`truncate font-semibold ${C.plain}`}>{row.username}</span>
                    {isYou && <span className={`shrink-0 text-xs ${C.comment}`}>{'// siz'}</span>}
                </span>
                {Object.keys(DIFFICULTY).map(k => (
                    <span key={k} className={`hidden md:block text-right tabular-nums ${row[k] ? LEVEL_COLOR[k] : 'text-[#484f58]'}`}>{row[k]}</span>
                ))}
                <AsciiBar points={row.points} max={max} />
                <span className={`text-right font-bold tabular-nums ${C.number}`}>{row.points}</span>
            </button>
            {open && <UserJson row={row} max={max} />}
        </li>
    );
}

// 1–3-o'rin: har biri o'z "fayl oynasi"da. Keng ekranda tartib 2 · 1 · 3
const TOP = [
    {
        file: 'champion.js', title: 'CHAMPION', order: 'lg:order-2', text: 'text-[#e3b341]',
        border: 'border-[#e3b341]/70', glow: 'shadow-[0_0_40px_-8px_rgba(227,179,65,0.55)]',
        tint: 'from-[#e3b341]/[0.16]', line: 'bg-[#e3b341]', ring: 'ring-[#e3b341]',
    },
    {
        file: 'runner_up.js', title: '2ND PLACE', order: 'lg:order-1', text: 'text-[#c9d1d9]',
        border: 'border-[#8b949e]/60', glow: 'shadow-[0_0_28px_-12px_rgba(201,209,217,0.5)]',
        tint: 'from-[#c9d1d9]/[0.10]', line: 'bg-[#c9d1d9]', ring: 'ring-[#c9d1d9]',
    },
    {
        file: 'third_place.js', title: '3RD PLACE', order: 'lg:order-3', text: 'text-[#f0883e]',
        border: 'border-[#f0883e]/50', glow: 'shadow-[0_0_28px_-12px_rgba(240,136,62,0.55)]',
        tint: 'from-[#f0883e]/[0.10]', line: 'bg-[#f0883e]', ring: 'ring-[#f0883e]',
    },
];

function TopCard({ row, isYou }) {
    const t = TOP[row.rank - 1];
    const first = row.rank === 1;
    return (
        <li className={`flex flex-col rounded-lg border bg-[#0d1117] overflow-hidden ${t.border} ${t.glow} ${t.order}`}>
            <span className={`h-[3px] ${t.line}`} />
            <div className="flex items-center gap-2 border-b border-[#30363d] bg-[#161b22] px-3 py-1.5 text-[11px]">
                <span className={C.number}>JS</span>
                <span className={C.plain}>{t.file}</span>
                {isYou && <span className="rounded bg-[#388bfd]/20 px-1.5 text-[#58a6ff]">{'// siz'}</span>}
                <span className={`ml-auto font-bold tracking-widest ${t.text}`}>{t.title}</span>
            </div>

            <div className={`relative flex flex-col items-center gap-3 bg-gradient-to-b ${t.tint} to-transparent px-4 ${first ? 'pt-7 pb-6' : 'pt-5 pb-5'}`}>
                {/* Orqa fondagi katta o'rin raqami */}
                <span aria-hidden className={`absolute right-3 top-1 text-7xl font-black leading-none opacity-[0.12] select-none ${t.text}`}>{row.rank}</span>

                <div className="relative">
                    {first && <span aria-hidden className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl">👑</span>}
                    <div className={`rounded-lg overflow-hidden bg-[#21262d] flex items-center justify-center font-black text-white ring-2 ring-offset-4 ring-offset-[#0d1117] ${t.ring} ${first ? 'w-24 h-24 text-4xl' : 'w-[72px] h-[72px] text-2xl'}`}>
                        {row.avatarUrl
                            ? <img src={row.avatarUrl} alt="" className="w-full h-full object-cover" />
                            : row.username.charAt(0).toUpperCase()}
                    </div>
                </div>

                <div className="w-full text-center">
                    <p className={`truncate font-bold text-white ${first ? 'text-xl' : 'text-base'}`}>{row.username}</p>
                    <p className={`text-xs ${C.comment}`}>{`// level ${row.level} · ${row.solved} ta masala`}</p>
                </div>

                <p className="leading-none">
                    <span className={`font-black tabular-nums ${t.text} ${first ? 'text-5xl' : 'text-4xl'}`}>{row.points.toLocaleString()}</span>
                    <span className={`ml-1.5 text-xs ${C.comment}`}>pts</span>
                </p>

                <div className="grid grid-cols-3 gap-2 w-full">
                    {Object.entries(DIFFICULTY).map(([k, v]) => (
                        <div key={k} title={`${v.label}: ${row[k]} ta masala`} className="rounded-md border border-[#30363d] bg-[#161b22] py-1.5 text-center">
                            <p className={`text-lg font-bold tabular-nums leading-tight ${row[k] ? LEVEL_COLOR[k] : 'text-[#484f58]'}`}>{row[k]}</p>
                            <p className={`text-[10px] uppercase ${C.comment}`}>{k}</p>
                        </div>
                    ))}
                </div>
            </div>
        </li>
    );
}

// Foydalanuvchining holati kod ko'rinishida
function MySnippet({ data }) {
    const me = data.myRow;
    const comment = !me
        ? '// hali reytingda emassiz: birinchi masalani yeching'
        : data.toNext === null
            ? '// siz yetakchisiz. status: 👑'
            : data.toNext > 0
                ? `// keyingi o'ringa yana ${data.toNext} ball`
                : "// yuqoridagi bilan ballar teng";
    return (
        <div className="rounded-md border border-[#30363d] bg-[#161b22] px-4 py-3 text-xs sm:text-[13px] leading-6">
            <p className={C.comment}>{comment}</p>
            <p>
                <span className={C.keyword}>const </span><span className={C.func}>me</span><span className={C.keyword}> = </span>
                {me ? (
                    <>
                        <span className={C.plain}>{'{ '}</span>
                        {[['rank', me.rank], ['points', me.points], ['solved', me.solved], ['next', data.toNext]].map(([key, value], i) => (
                            <span key={key} className="whitespace-nowrap">
                                {i > 0 && <span className={C.plain}>, </span>}
                                <span className={C.plain}>{key}: </span><Value value={value} />
                            </span>
                        ))}
                        <span className={C.plain}>{' };'}</span>
                    </>
                ) : (
                    <>
                        <span className={C.number}>null</span><span className={C.plain}>; </span>
                        <Link href="/train" className="text-[#58a6ff] underline underline-offset-4">solve()</Link>
                    </>
                )}
            </p>
        </div>
    );
}

export default function TrainLeaderboard() {
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [shownPage, setShownPage] = useState(1); // hozir ko'rinib turgan ma'lumot sahifasi
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openUser, setOpenUser] = useState(null);
    const [elapsed, setElapsed] = useState(0);
    const { typed, done } = useTyping(COMMAND);

    useEffect(() => {
        let alive = true;
        const started = performance.now();
        setError('');
        setLoading(true);
        fetch(`/api/train/ranking?page=${page}&limit=${PER_PAGE}`)
            .then(async (res) => {
                const d = await res.json();
                if (!alive) return;
                if (!res.ok) return setError(d.message || 'Xatolik yuz berdi');
                setElapsed(Math.round(performance.now() - started));
                setData(d);
                setShownPage(page);
                setOpenUser(null);
            })
            .catch(() => alive && setError("Serverga ulanib bo'lmadi"))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [page]);

    const totalPages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1;

    // ← → tugmalari bilan sahifalash
    useEffect(() => {
        const onKey = (e) => {
            if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select')) return;
            if (e.key === 'ArrowLeft') setPage(p => Math.max(1, p - 1));
            if (e.key === 'ArrowRight') setPage(p => Math.min(totalPages, p + 1));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [totalPages]);

    const ready = done && data;
    const me = data?.myRow;
    // Birinchi uchlik yuqorida alohida ko'rsatiladi, jadval 4-o'rindan boshlanadi
    const rows = data?.ranking.filter(r => r.rank > 3) || [];
    const meOnPage = me && (me.rank <= 3 || rows.some(r => r.username === data.me));
    const max = data?.top[0]?.points || 1;
    const lineProps = (row) => ({
        row, max,
        isYou: row.username === data.me,
        open: openUser === row.username,
        onToggle: () => setOpenUser(u => (u === row.username ? null : row.username)),
    });
    const pagerBtn = 'px-2 py-0.5 rounded border border-[#30363d] text-[#c9d1d9] hover:border-[#58a6ff] hover:text-white disabled:opacity-30 disabled:hover:border-[#30363d]';

    return (
        <div style={MONO} className="rounded-lg border border-[#30363d] bg-[#0d1117] text-sm shadow-2xl shadow-black/40">
            {/* Oyna sarlavhasi */}
            <div className="flex items-center gap-3 rounded-t-lg border-b border-[#30363d] bg-[#161b22] px-4 py-2.5">
                <div aria-hidden className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                    <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                    <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
                </div>
                <p className={`flex-1 truncate text-center text-xs ${C.comment}`}>dev@quiz: ~/train — leaderboard</p>
                <span aria-hidden className="w-12" />
            </div>

            <div className="p-3 sm:p-4 space-y-3">
                <Prompt>{typed}{!done && <Cursor />}</Prompt>

                {error && <p className="text-[#f85149]">error: {error}</p>}
                {!error && done && !data && <p className={C.comment}>fetching ranking<span className="animate-pulse">...</span></p>}

                {ready && !error && (
                    <>
                        <p className="text-xs">
                            <span className="text-[#3fb950]">✓ </span>
                            <span className={C.comment}>{data.total} coders loaded in {elapsed}ms</span>
                        </p>

                        <MySnippet data={data} />

                        {data.total === 0 && (
                            <p className={`rounded-md border border-[#30363d] px-4 py-10 text-center ${C.comment}`}>
                                {'// 0 natija. '}<Link href="/train" className="text-[#58a6ff] underline underline-offset-4">Birinchi commit sizniki bo&apos;lsin →</Link>
                            </p>
                        )}

                        {data.top.length > 0 && (
                            <ol className="grid gap-4 lg:grid-cols-[1fr_1.15fr_1fr] lg:items-end pt-2 pb-1">
                                {data.top.map(row => <TopCard key={row.username} row={row} isYou={row.username === data.me} />)}
                            </ol>
                        )}

                        {data.total > 3 && (
                        <div className={`rounded-md border border-[#30363d] transition-opacity ${loading ? 'opacity-40' : ''}`}>
                            <div className={`${ROW} rounded-t-md border-b border-[#30363d] bg-[#161b22] py-2 text-[11px] ${C.comment}`}>
                                <span />
                                <span>#</span>
                                <span>CODER</span>
                                <span className={`hidden md:block text-right ${LEVEL_COLOR.Easy}`} title="Oson">EZ</span>
                                <span className={`hidden md:block text-right ${LEVEL_COLOR.Medium}`} title="O'rta">MD</span>
                                <span className={`hidden md:block text-right ${LEVEL_COLOR.Hard}`} title="Qiyin">HD</span>
                                <span className="hidden 2xl:block">PROGRESS</span>
                                <span className="text-right">PTS</span>
                            </div>

                            <ol className="py-1">
                                {rows.map((row, i) => (
                                    // Qator raqami jadval boshidan sanaladi
                                    <Line key={row.username} line={Math.max(0, (shownPage - 1) * PER_PAGE - 3) + i + 1} {...lineProps(row)} />
                                ))}
                            </ol>

                            {/* O'z qatoringiz boshqa sahifada bo'lsa */}
                            {me && !meOnPage && (
                                <ol className="border-t border-dashed border-[#30363d] py-1">
                                    <Line line="~" {...lineProps(me)} />
                                </ol>
                            )}
                        </div>
                        )}

                        {data.total > 3 && <p className={`text-xs ${C.comment}`}>{"# qatorni bosing → to'liq ma'lumot · ← → sahifalash"}</p>}
                        <Prompt><Cursor /></Prompt>
                    </>
                )}
            </div>

            {/* Vim uslubidagi holat qatori */}
            <div className="flex items-center gap-3 rounded-b-lg border-t border-[#30363d] bg-[#161b22] pr-3 text-[11px]">
                <span className={`self-stretch flex items-center rounded-bl-lg px-3 py-2 font-bold text-[#0d1117] ${loading ? 'bg-[#d29922]' : 'bg-[#3fb950]'}`}>
                    {loading ? 'LOADING' : 'NORMAL'}
                </span>
                <span className={`hidden sm:inline ${C.comment}`}>⎇ main</span>
                <span className="hidden md:inline text-[#8b949e]">
                    {Object.entries(DIFFICULTY).map(([k, v]) => (
                        <span key={k} className="mr-3"><span className={LEVEL_COLOR[k]}>{k.toLowerCase()}</span>=+{v.xp}</span>
                    ))}
                </span>
                <div className="ml-auto flex items-center gap-2 py-1.5">
                    <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} aria-label="Oldingi sahifa" className={pagerBtn}>← prev</button>
                    <span className={C.comment}>{page}/{totalPages}</span>
                    <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} aria-label="Keyingi sahifa" className={pagerBtn}>next →</button>
                </div>
            </div>
        </div>
    );
}

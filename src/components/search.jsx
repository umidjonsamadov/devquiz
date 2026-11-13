'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search, X, CornerDownLeft, Loader2,
    HomeIcon, BookOpenIcon, TrophyIcon, PlusIcon, UserIcon, Settings,
    Shield, Library, HelpCircle, ArrowLeft,
} from 'lucide-react';

// Statik sahifalar — server so'rovisiz darhol topiladi
const PAGES = [
    { label: 'Dashboard', route: '/dashboard', icon: HomeIcon, keywords: 'bosh sahifa home asosiy statistika' },
    { label: 'Solve Quiz', route: '/quiz', icon: BookOpenIcon, keywords: 'quiz test savol yechish' },
    { label: 'Leaderboard', route: '/leaderboard', icon: TrophyIcon, keywords: 'reyting top jadval' },
    { label: 'Profil', route: '/user', icon: UserIcon, keywords: 'profile men akkaunt' },
    { label: 'Sozlamalar', route: '/settings', icon: Settings, keywords: 'settings parol avatar' },
    { label: 'Savol yaratish', route: '/create', icon: PlusIcon, keywords: 'create question yangi', admin: true },
    { label: 'Admin Panel', route: '/admin', icon: Shield, keywords: 'admin boshqaruv', admin: true },
];

const AVATAR_BG = {
    green: 'bg-green-900 text-green-400', blue: 'bg-blue-900 text-blue-400',
    purple: 'bg-purple-900 text-purple-400', orange: 'bg-orange-900 text-orange-400',
    red: 'bg-red-900 text-red-400', pink: 'bg-pink-900 text-pink-400',
    yellow: 'bg-yellow-900 text-yellow-400', cyan: 'bg-cyan-900 text-cyan-400',
};

const DIFF_STYLE = {
    Easy: 'text-green-400 bg-green-500/10',
    Medium: 'text-yellow-400 bg-yellow-500/10',
    Hard: 'text-red-400 bg-red-500/10',
};

const EMPTY = { categories: [], questions: [], users: [] };

// Topilgan qismni yashil rangda ajratib ko'rsatish
function Highlight({ text, query }) {
    if (!query) return text;
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    if (i === -1) return text;
    return (
        <>
            {text.slice(0, i)}
            <mark className="bg-transparent text-green-400 font-semibold">{text.slice(i, i + query.length)}</mark>
            {text.slice(i + query.length)}
        </>
    );
}

function useSearch(query) {
    const [data, setData] = useState(EMPTY);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const cache = useRef(new Map());

    useEffect(() => {
        const q = query.trim();
        if (!q) { setData(EMPTY); setLoading(false); setError(false); return; }

        const key = q.toLowerCase();
        if (cache.current.has(key)) { setData(cache.current.get(key)); setLoading(false); return; }

        const ctrl = new AbortController();
        setLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
                if (!res.ok) throw new Error();
                const json = await res.json();
                cache.current.set(key, json);
                setData(json);
                setError(false);
            } catch (e) {
                if (e.name !== 'AbortError') setError(true);
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 220);

        return () => { clearTimeout(t); ctrl.abort(); };
    }, [query]);

    return { data, loading, error };
}

function SearchResults({ query, isAdmin, onSelect, activeIndex, setActiveIndex, items, loading, error }) {
    const q = query.trim();

    const groups = [
        { key: 'pages', title: 'Sahifalar' },
        { key: 'categories', title: 'Kategoriyalar' },
        { key: 'questions', title: 'Savollar' },
        { key: 'users', title: 'Foydalanuvchilar' },
    ];

    if (!q) {
        return (
            <div className="p-2">
                <p className="px-3 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Tezkor o&apos;tish</p>
                {items.map((item, i) => (
                    <ResultRow key={item.id} item={item} query="" active={activeIndex === i}
                        onHover={() => setActiveIndex(i)} onClick={() => onSelect(item)} />
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        if (loading) {
            return (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" /> Qidirilmoqda...
                </div>
            );
        }
        return (
            <div className="py-10 px-6 text-center">
                <div className="mx-auto mb-3 w-11 h-11 rounded-xl bg-gray-800 flex items-center justify-center">
                    <Search size={18} className="text-gray-500" />
                </div>
                <p className="text-sm text-gray-300">
                    {error ? 'Qidiruvda xato yuz berdi' : <>&laquo;<span className="text-white font-medium">{q}</span>&raquo; bo&apos;yicha hech narsa topilmadi</>}
                </p>
                <p className="mt-1 text-xs text-gray-500">Boshqa so&apos;z bilan urinib ko&apos;ring</p>
            </div>
        );
    }

    return (
        <div className="p-2">
            {groups.map(g => {
                const list = items.filter(it => it.group === g.key);
                if (!list.length) return null;
                return (
                    <div key={g.key} className="mb-1 last:mb-0">
                        <p className="px-3 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{g.title}</p>
                        {list.map(item => {
                            const idx = items.indexOf(item);
                            return (
                                <ResultRow key={item.id} item={item} query={q} active={activeIndex === idx}
                                    onHover={() => setActiveIndex(idx)} onClick={() => onSelect(item)} />
                            );
                        })}
                    </div>
                );
            })}
            {loading && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
                    <Loader2 size={12} className="animate-spin" /> Yangilanmoqda...
                </div>
            )}
        </div>
    );
}

function ResultRow({ item, query, active, onHover, onClick }) {
    const Icon = item.icon;
    return (
        <button
            type="button"
            data-active={active}
            onMouseMove={onHover}
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                active ? 'bg-gray-800' : 'hover:bg-gray-800/60'
            }`}
        >
            {item.avatar ? (
                <div className={`w-8 h-8 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-sm font-semibold ${AVATAR_BG[item.avatar.color] || AVATAR_BG.green}`}>
                    {item.avatar.url
                        ? <img src={item.avatar.url} alt="" className="w-full h-full object-cover" />
                        : item.label.charAt(0).toUpperCase()}
                </div>
            ) : (
                <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${active ? 'bg-green-900/60 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                    <Icon size={16} />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <p className={`text-sm truncate ${active ? 'text-white' : 'text-gray-200'}`}>
                    <Highlight text={item.label} query={query} />
                </p>
                {item.sub && <p className="text-xs text-gray-500 truncate">{item.sub}</p>}
            </div>
            {item.badge && (
                <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md ${item.badgeClass || 'text-gray-400 bg-gray-800'}`}>
                    {item.badge}
                </span>
            )}
            {active && <CornerDownLeft size={14} className="shrink-0 text-gray-500 hidden sm:block" />}
        </button>
    );
}

function SearchPanel({ isAdmin, onClose, autoFocus, variant }) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const { data, loading, error } = useSearch(query);

    useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

    const items = useMemo(() => {
        const q = query.trim().toLowerCase();
        const pages = PAGES.filter(p => !p.admin || isAdmin)
            .filter(p => !q || p.label.toLowerCase().includes(q) || p.keywords.includes(q))
            .slice(0, q ? 4 : 5)
            .map(p => ({ id: 'p' + p.route, group: 'pages', label: p.label, icon: p.icon, route: p.route }));
        if (!q) return pages;

        return [
            ...pages,
            ...data.categories.map(c => ({
                id: 'c' + c.category, group: 'categories', label: c.category, icon: Library,
                sub: `${c.count} ta savol`, badge: 'Boshlash', badgeClass: 'text-green-400 bg-green-500/10',
                route: `/quiz/${encodeURIComponent(c.category)}`,
            })),
            ...data.questions.map(x => ({
                id: 'q' + x.id, group: 'questions', label: x.question, icon: HelpCircle,
                sub: x.category, badge: x.difficulty, badgeClass: DIFF_STYLE[x.difficulty],
                route: `/quiz/${encodeURIComponent(x.category)}`,
            })),
            ...data.users.map(u => ({
                id: 'u' + u.id, group: 'users', label: u.username,
                sub: `Lv ${u.level} · ${u.xp} XP`, avatar: { url: u.avatarUrl, color: u.avatarColor },
                route: '/leaderboard',
            })),
        ];
    }, [query, data, isAdmin]);

    useEffect(() => { setActiveIndex(0); }, [query, data]);

    // Tanlangan qatorni ko'rinadigan joyga scroll qilish
    useEffect(() => {
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const select = useCallback((item) => {
        onClose();
        router.push(item.route);
    }, [onClose, router]);

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => (items.length ? (i + 1) % items.length : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => (items.length ? (i - 1 + items.length) % items.length : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (items[activeIndex]) select(items[activeIndex]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            inputRef.current?.blur();
        }
    };

    const isMobile = variant === 'mobile';

    return (
        <div className={`flex flex-col ${isMobile ? 'h-full' : 'max-h-[min(70vh,520px)]'}`}>
            <div className={`flex items-center gap-3 border-b border-gray-800 ${isMobile ? 'px-3 h-16' : 'px-4 h-12'}`}>
                {isMobile ? (
                    <button type="button" onClick={onClose} aria-label="Orqaga"
                        className="w-10 h-10 -ml-1 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800">
                        <ArrowLeft size={20} />
                    </button>
                ) : (
                    <Search size={16} className="text-gray-500 shrink-0" />
                )}
                <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Kategoriya, savol yoki foydalanuvchi..."
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    aria-label="Qidirish"
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-white text-base sm:text-sm placeholder-gray-500 [&::-webkit-search-cancel-button]:hidden"
                />
                {loading && <Loader2 size={15} className="animate-spin text-gray-500 shrink-0" />}
                {query && (
                    <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Tozalash"
                        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-gray-800 shrink-0">
                        <X size={15} />
                    </button>
                )}
                {!isMobile && (
                    <kbd className="hidden lg:inline-flex text-[10px] text-gray-500 border border-gray-700 rounded px-1.5 py-0.5 shrink-0">ESC</kbd>
                )}
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain">
                <SearchResults query={query} isAdmin={isAdmin} onSelect={select} activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex} items={items} loading={loading} error={error} />
            </div>

            {!isMobile && (
                <div className="hidden lg:flex items-center gap-4 px-4 py-2 border-t border-gray-800 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1"><kbd className="border border-gray-700 rounded px-1">↑</kbd><kbd className="border border-gray-700 rounded px-1">↓</kbd> tanlash</span>
                    <span className="flex items-center gap-1"><kbd className="border border-gray-700 rounded px-1">Enter</kbd> ochish</span>
                    <span className="flex items-center gap-1"><kbd className="border border-gray-700 rounded px-1">Esc</kbd> yopish</span>
                </div>
            )}
        </div>
    );
}

export default function HeaderSearch({ isAdmin = false }) {
    const [open, setOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const wrapRef = useRef(null);

    const close = useCallback(() => { setOpen(false); setMobileOpen(false); }, []);

    // Ctrl+K / Cmd+K / "/" — qidiruvni ochish
    useEffect(() => {
        const onKey = (e) => {
            const tag = document.activeElement?.tagName;
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
            if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
                e.preventDefault();
                if (window.innerWidth >= 1024) setOpen(true);
                else setMobileOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Tashqariga bosilganda yopish (desktop)
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    // Mobil oyna ochiqligida orqa fonni scroll qilmaslik
    useEffect(() => {
        if (!mobileOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [mobileOpen]);

    return (
        <>
            {/* Desktop (lg+): header ichidagi qidiruv + ochiladigan panel */}
            <div ref={wrapRef} className="relative hidden lg:block w-64 xl:w-80 h-10">
                {!open ? (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="w-full h-10 flex items-center gap-3 bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg px-4 text-left transition-colors"
                    >
                        <Search size={15} className="text-gray-500 shrink-0" />
                        <span className="flex-1 text-sm text-gray-500">Qidirish...</span>
                        <kbd className="text-[10px] text-gray-500 border border-gray-700 rounded px-1.5 py-0.5">Ctrl K</kbd>
                    </button>
                ) : (
                    <div className="absolute left-0 top-0 w-[min(560px,calc(100vw-2rem))] z-[60] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
                        <SearchPanel isAdmin={isAdmin} onClose={close} autoFocus variant="desktop" />
                    </div>
                )}
            </div>

            {/* Telefon / planshet: ikonka */}
            <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Qidirish"
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
                <Search size={19} />
            </button>

            {/* Telefon / planshet: to'liq ekranli qidiruv */}
            {mobileOpen && (
                <div className="lg:hidden fixed inset-0 z-[300] flex flex-col sm:items-center sm:justify-start sm:pt-[10vh] sm:px-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm hidden sm:block" onClick={close} />
                    <div className="relative w-full h-full sm:h-auto sm:max-h-[75vh] sm:max-w-xl bg-gray-900 sm:border sm:border-gray-700 sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                        <SearchPanel isAdmin={isAdmin} onClose={close} autoFocus variant="mobile" />
                    </div>
                </div>
            )}
        </>
    );
}

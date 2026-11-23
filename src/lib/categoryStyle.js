import {
    BookOpen, Code, Globe, Cpu, Database, Layout, Zap, Shield, Terminal,
    FileCode, Layers, Box, Brain, Cloud, Smartphone, Server, GitBranch,
    Bug, Palette, Rocket, Wrench, Braces, Network, Lock,
} from 'lucide-react';

// Admin tanlay oladigan ikonlar (nom -> komponent)
export const ICONS = {
    BookOpen, Code, Globe, Cpu, Database, Layout, Zap, Shield, Terminal,
    FileCode, Layers, Box, Brain, Cloud, Smartphone, Server, GitBranch,
    Bug, Palette, Rocket, Wrench, Braces, Network, Lock,
};

// Tailwind klasslari to'liq yozilishi shart (dinamik yig'ib bo'lmaydi)
export const COLORS = {
    blue:   { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   glow: 'hover:border-blue-500/40',   accent: 'from-blue-500/10',   selBorder: 'border-blue-400',   dot: 'bg-blue-400' },
    yellow: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', glow: 'hover:border-yellow-500/40', accent: 'from-yellow-500/10', selBorder: 'border-yellow-400', dot: 'bg-yellow-400' },
    cyan:   { color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   glow: 'hover:border-cyan-500/40',   accent: 'from-cyan-500/10',   selBorder: 'border-cyan-400',   dot: 'bg-cyan-400' },
    pink:   { color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/20',   glow: 'hover:border-pink-500/40',   accent: 'from-pink-500/10',   selBorder: 'border-pink-400',   dot: 'bg-pink-400' },
    orange: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', glow: 'hover:border-orange-500/40', accent: 'from-orange-500/10', selBorder: 'border-orange-400', dot: 'bg-orange-400' },
    purple: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', glow: 'hover:border-purple-500/40', accent: 'from-purple-500/10', selBorder: 'border-purple-400', dot: 'bg-purple-400' },
    sky:    { color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20',    glow: 'hover:border-sky-500/40',    accent: 'from-sky-500/10',    selBorder: 'border-sky-400',    dot: 'bg-sky-400' },
    gray:   { color: 'text-white',      bg: 'bg-gray-500/10',   border: 'border-gray-500/20',   glow: 'hover:border-gray-500/40',   accent: 'from-gray-500/10',   selBorder: 'border-gray-300',   dot: 'bg-gray-300' },
    red:    { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    glow: 'hover:border-red-500/40',    accent: 'from-red-500/10',    selBorder: 'border-red-400',    dot: 'bg-red-400' },
    green:  { color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  glow: 'hover:border-green-500/40',  accent: 'from-green-500/10',  selBorder: 'border-green-400',  dot: 'bg-green-400' },
    teal:   { color: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20',   glow: 'hover:border-teal-500/40',   accent: 'from-teal-500/10',   selBorder: 'border-teal-400',   dot: 'bg-teal-400' },
};

export function getStyle(cat) {
    const Icon = ICONS[cat?.icon] || BookOpen;
    const c = COLORS[cat?.color] || COLORS.green;
    return { Icon, ...c };
}

// Birinchi marta ishga tushganda yaratiladigan standart kategoriyalar
export const DEFAULT_CATEGORIES = [
    { name: 'Python', icon: 'Terminal', color: 'blue' },
    { name: 'JavaScript', icon: 'Code', color: 'yellow' },
    { name: 'TypeScript', icon: 'FileCode', color: 'sky' },
    { name: 'React', icon: 'Layers', color: 'cyan' },
    { name: 'Next.js', icon: 'Zap', color: 'gray' },
    { name: 'HTML', icon: 'Globe', color: 'orange' },
    { name: 'CSS', icon: 'Layout', color: 'pink' },
    { name: 'SQL', icon: 'Database', color: 'purple' },
    { name: 'Algorithms', icon: 'Cpu', color: 'green' },
    { name: 'Cybersecurity', icon: 'Shield', color: 'red' },
    { name: 'Docker', icon: 'Box', color: 'teal' },
];

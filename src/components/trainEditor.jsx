"use client";

import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Loader2, RotateCcw, Code2, Maximize2, Minimize2 } from 'lucide-react';
import { checkPythonSyntax, preloadPython } from '../lib/codeRunner';
import { LANGUAGES } from '../lib/train';

// Muharrir foni sahifadagi panellar bilan bir xil
const defineTheme = (monaco) => monaco.editor.defineTheme('train-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
        'editor.background': '#111827',
        'editorGutter.background': '#111827',
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': '#d1d5db',
        'editor.lineHighlightBackground': '#1f293780',
        'editor.lineHighlightBorder': '#00000000',
    },
});

const toolBtn = 'p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-700 disabled:opacity-40';

/** Train uchun kod muharriri. Ishga tushirish tugmasi sahifaning o'zida. */
export default function TrainEditor({ language, languages, onLanguage, value, onChange, onReset, onRun, disabled, expanded, onExpand }) {
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const runRef = useRef(onRun);
    const [pos, setPos] = useState({ ln: 1, col: 1 });
    const [errors, setErrors] = useState(0);
    const [pyState, setPyState] = useState('idle'); // idle | loading | ready | failed
    const [mounted, setMounted] = useState(false);

    // Monaco buyrug'i bir marta ro'yxatdan o'tadi, shuning uchun eng so'nggi funksiya ref orqali chaqiriladi
    useEffect(() => { runRef.current = onRun; }, [onRun]);

    useEffect(() => {
        if (language !== 'python') return;
        let alive = true;
        setPyState('loading');
        preloadPython().then(() => alive && setPyState('ready')).catch(() => alive && setPyState('failed'));
        return () => { alive = false; };
    }, [language]);

    // Python sintaksis xatolarini qizil chiziq bilan ko'rsatish
    useEffect(() => {
        if (language !== 'python' || !mounted) return;
        const monaco = monacoRef.current;
        const model = editorRef.current.getModel();
        let alive = true;
        const timer = setTimeout(async () => {
            const err = await checkPythonSyntax(value || '');
            if (!alive || !model || model.isDisposed()) return;
            const line = err && Math.min(Math.max(1, err.line), model.getLineCount());
            monaco.editor.setModelMarkers(model, 'python', err ? [{
                severity: monaco.MarkerSeverity.Error,
                message: `SyntaxError: ${err.msg}`,
                startLineNumber: line, endLineNumber: line,
                startColumn: Math.min(Math.max(1, err.col || 1), model.getLineMaxColumn(line)),
                endColumn: model.getLineMaxColumn(line),
            }] : []);
        }, 500);
        return () => { alive = false; clearTimeout(timer); };
    }, [value, language, pyState, mounted]);

    const handleMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false, noSyntaxValidation: false, diagnosticCodesToIgnore: [2307, 2792, 2580, 1375, 1378],
        });
        editor.onDidChangeCursorPosition(e => setPos({ ln: e.position.lineNumber, col: e.position.column }));
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current?.());
        setMounted(true);
    };

    return (
        <div className="h-full flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="h-10 shrink-0 flex items-center gap-2 px-3 bg-gray-800/60 border-b border-gray-800">
                <Code2 size={14} className="text-green-400" />
                <span className="text-xs font-semibold text-white">Kod</span>
                <span className="w-px h-4 bg-gray-700" />
                <select value={language} onChange={e => onLanguage(e.target.value)} disabled={disabled} aria-label="Dasturlash tili"
                    className="bg-transparent hover:bg-gray-700 rounded-md px-1.5 py-1 text-xs text-gray-300 outline-none cursor-pointer">
                    {languages.map(l => <option key={l} value={l} className="bg-gray-800">{LANGUAGES[l]}</option>)}
                </select>
                <div className="ml-auto flex items-center gap-1">
                    <button onClick={onReset} disabled={disabled} title="Kodni qayta boshlash" className={toolBtn}><RotateCcw size={14} /></button>
                    <button onClick={onExpand} title={expanded ? 'Kichraytirish' : 'Muharrirni kengaytirish'} className={`${toolBtn} hidden lg:block`}>
                        {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <Editor
                    height="100%"
                    theme="train-dark"
                    beforeMount={defineTheme}
                    language={language}
                    path={`train/${language === 'python' ? 'main.py' : 'main.js'}`}
                    value={value}
                    onChange={(v) => onChange(v ?? '')}
                    onMount={handleMount}
                    onValidate={(markers) => setErrors(markers.filter(m => m.severity === 8).length)}
                    loading={<div className="text-gray-500 text-xs flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Muharrir yuklanmoqda…</div>}
                    options={{
                        fontSize: 14,
                        lineHeight: 22,
                        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
                        fontLigatures: true,
                        tabSize: language === 'python' ? 4 : 2,
                        insertSpaces: true,
                        automaticLayout: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        bracketPairColorization: { enabled: true },
                        wordBasedSuggestions: 'currentDocument',
                        overviewRulerLanes: 0,
                        lineNumbersMinChars: 3,
                        padding: { top: 10 },
                    }}
                />
            </div>

            <div className="h-7 shrink-0 flex items-center gap-4 px-3 border-t border-gray-800 text-[11px] text-gray-500">
                {errors > 0 && <span className="text-red-400">{errors} ta xato</span>}
                {language === 'python' && pyState === 'loading' && (
                    <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Python yuklanmoqda</span>
                )}
                {language === 'python' && pyState === 'failed' && <span className="text-red-400">Python yuklanmadi (internet?)</span>}
                <span className="ml-auto">Qator {pos.ln}, ustun {pos.col}</span>
            </div>
        </div>
    );
}

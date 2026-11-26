"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Play, FlaskConical, Eraser, Terminal as TermIcon, AlertCircle, XCircle, CheckCircle2, FileCode2, Loader2 } from 'lucide-react';
import { runProgram, runTests, checkPythonSyntax, preloadPython } from '../lib/codeRunner';

const FILE = { javascript: 'main.js', python: 'main.py' };
const LABEL = { javascript: 'JavaScript', python: 'Python' };

const PY_WORDS = [
    'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or', 'import', 'from', 'as', 'try', 'except',
    'finally', 'raise', 'with', 'lambda', 'pass', 'break', 'continue', 'yield', 'None', 'True', 'False', 'print', 'len', 'range',
    'enumerate', 'zip', 'map', 'filter', 'sorted', 'sum', 'min', 'max', 'abs', 'round', 'int', 'str', 'float', 'list', 'dict', 'set',
    'tuple', 'bool', 'isinstance', 'reversed', 'any', 'all', 'append', 'extend', 'pop', 'join', 'split', 'strip', 'format',
];

let pyCompletionRegistered = false;

/**
 * WebStorm/PyCharm uslubidagi kod muharriri (Monaco): sintaksis xatolari, avtoto'ldirish,
 * pastda terminal, o'lchami o'zgartiriladigan oyna.
 *
 * Props: language ('python' | 'javascript'), value, onChange, functionName, testCases,
 *        lines/setLines (terminal), onTests(res)
 */
export default function CodeIDE({ language, value, onChange, functionName, testCases, lines, setLines, onTests }) {
    const wrapRef = useRef(null);
    const bodyRef = useRef(null);
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const split = 0.7;                               // muharrir ulushi (qolgani terminal), qat'iy
    const [tab, setTab] = useState('terminal');      // terminal | problems
    const [markers, setMarkers] = useState([]);
    const [pos, setPos] = useState({ ln: 1, col: 1 });
    const [busy, setBusy] = useState(null);          // null | 'run' | 'test'
    const [pyState, setPyState] = useState(language === 'python' ? 'loading' : 'idle');
    const termRef = useRef(null);
    const [ask, setAsk] = useState(null);            // dastur input kutayotganda { prompt, resolve }
    const [typed, setTyped] = useState('');

    const askInput = (prompt) => new Promise((resolve) => { setTyped(''); setTab('terminal'); setAsk({ prompt, resolve }); });
    const answer = (value) => { ask?.resolve(value); setAsk(null); };

    const errors = markers.filter(m => m.severity === 8);

    // Python muhitini oldindan yuklash
    useEffect(() => {
        if (language !== 'python') return;
        let alive = true;
        setPyState('loading');
        preloadPython().then(() => alive && setPyState('ready')).catch(() => alive && setPyState('failed'));
        return () => { alive = false; };
    }, [language]);

    // Python sintaksis xatolarini (qizil chiziq) chiqarish
    useEffect(() => {
        if (language !== 'python' || !monacoRef.current || !editorRef.current) return;
        const monaco = monacoRef.current;
        const model = editorRef.current.getModel();
        if (!model) return;
        let alive = true;
        const t = setTimeout(async () => {
            const err = await checkPythonSyntax(value || '');
            if (!alive || model.isDisposed()) return;
            if (!err) { monaco.editor.setModelMarkers(model, 'python', []); return; }
            const line = Math.min(Math.max(1, err.line), model.getLineCount());
            const startCol = Math.max(1, err.col || 1);
            monaco.editor.setModelMarkers(model, 'python', [{
                severity: monaco.MarkerSeverity.Error,
                message: `SyntaxError: ${err.msg}`,
                startLineNumber: line, endLineNumber: line,
                startColumn: Math.min(startCol, model.getLineMaxColumn(line)),
                endColumn: model.getLineMaxColumn(line),
            }]);
        }, 500);
        return () => { alive = false; clearTimeout(t); };
    }, [value, language, pyState]);

    // Terminal pastga aylanadi
    useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [lines, tab, ask]);

    const handleMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // "modul topilmadi" va require xatolari ko'rsatilmaydi: modullar ishga tushirishda yuklanadi
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false, diagnosticCodesToIgnore: [2307, 2792, 2580, 1375, 1378] });
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({ allowNonTsExtensions: true, target: monaco.languages.typescript.ScriptTarget.ES2020 });

        if (!pyCompletionRegistered) {
            pyCompletionRegistered = true;
            monaco.languages.registerCompletionItemProvider('python', {
                provideCompletionItems: (model, position) => {
                    const w = model.getWordUntilPosition(position);
                    const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
                    return { suggestions: PY_WORDS.map(k => ({ label: k, kind: monaco.languages.CompletionItemKind.Keyword, insertText: k, range })) };
                },
            });
        }

        editor.onDidChangeCursorPosition(e => setPos({ ln: e.position.lineNumber, col: e.position.column }));
        // Ctrl+Enter = Run
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => document.getElementById('ide-run')?.click());
    };

    const push = useCallback((stream, text) => {
        setLines(l => [...l, { stream, text }].slice(-500));
    }, [setLines]);

    const run = async () => {
        if (busy) return;
        setBusy('run'); setTab('terminal');
        push('cmd', `$ ${language === 'python' ? 'python' : 'node'} ${FILE[language]}`);
        if (language === 'python' && pyState !== 'ready') push('info', 'Python muhiti yuklanmoqda, kuting…');
        await runProgram({ language, code: value || '', onLine: (l) => push(l.stream, l.text), onInput: askInput });
        push('info', '[jarayon tugadi]');
        setBusy(null);
    };

    const test = async () => {
        if (busy) return;
        setBusy('test'); setTab('terminal');
        push('cmd', `$ test ${functionName}()  (${testCases.length} ta test-case)`);
        if (language === 'python' && pyState !== 'ready') push('info', 'Python muhiti yuklanmoqda, kuting…');
        const res = await runTests({ language, code: value || '', functionName, testCases });
        if (res.error) push('err', res.error);
        res.results.forEach((r, i) => {
            const t = testCases[i];
            push(r.ok ? 'ok' : 'err', `${r.ok ? '✓' : '✗'} Test ${i + 1}: ${functionName}(${(t.args || []).map(a => JSON.stringify(a)).join(', ')}) → ${r.got}${r.ok ? '' : `   (kutilgan: ${JSON.stringify(t.expected)})`}`);
        });
        push(res.passed === res.total ? 'ok' : 'info', `${res.passed}/${res.total} test-case o'tdi`);
        onTests?.({ ...res, code: value || '' });
        setBusy(null);
    };

    const color = { out: 'text-gray-200', err: 'text-red-400', ok: 'text-green-400', info: 'text-blue-300', cmd: 'text-yellow-300' };

    return (
        <div
            ref={wrapRef}
            data-ide
            // Ekran balandligini to'liq egallaydi (tepa bar + chetlar ayirib tashlangan), o'lchami o'zgarmaydi
            style={{ height: 'calc(100vh - 100px)', minHeight: 420, overflow: 'hidden' }}
            className="flex flex-col rounded-xl border border-gray-700 bg-[#1e1e1e] select-text"
        >
            {/* Toolbar */}
            <div className="h-10 shrink-0 flex items-center gap-2 px-2 bg-[#2b2b2b] border-b border-black/40">
                <div className="flex items-center gap-1.5 px-3 h-full bg-[#1e1e1e] border-t-2 border-blue-500 text-xs text-gray-200">
                    <FileCode2 size={13} className={language === 'python' ? 'text-yellow-300' : 'text-yellow-400'} />
                    {FILE[language]}
                </div>
                <span className="text-[11px] text-gray-500">{LABEL[language]}</span>
                <div className="ml-auto flex items-center gap-1.5">
                    <button id="ide-run" onClick={run} disabled={!!busy} title="Ishga tushirish (Ctrl+Enter)"
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-md">
                        {busy === 'run' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Run
                    </button>
                    {testCases?.length > 0 && (
                        <button onClick={test} disabled={!!busy}
                            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-md">
                            {busy === 'test' ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} Run tests
                        </button>
                    )}
                </div>
            </div>

            {/* Muharrir + terminal */}
            <div ref={bodyRef} className="flex-1 min-h-0 flex flex-col">
                <div style={{ height: `${split * 100}%` }} className="min-h-0">
                    <Editor
                        height="100%"
                        theme="vs-dark"
                        language={language}
                        path={`exam/${FILE[language]}`}
                        value={value}
                        onChange={(v) => onChange(v ?? '')}
                        onMount={handleMount}
                        onValidate={setMarkers}
                        loading={<div className="text-gray-500 text-xs p-4 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Muharrir yuklanmoqda…</div>}
                        options={{
                            fontSize: 14,
                            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
                            fontLigatures: true,
                            tabSize: language === 'python' ? 4 : 2,
                            insertSpaces: true,
                            automaticLayout: true,
                            minimap: { enabled: true },
                            scrollBeyondLastLine: false,
                            bracketPairColorization: { enabled: true },
                            guides: { indentation: true, bracketPairs: true },
                            renderLineHighlight: 'all',
                            smoothScrolling: true,
                            cursorBlinking: 'smooth',
                            cursorSmoothCaretAnimation: 'on',
                            quickSuggestions: true,
                            wordBasedSuggestions: 'currentDocument',
                            suggestOnTriggerCharacters: true,
                            autoClosingBrackets: 'always',
                            autoClosingQuotes: 'always',
                            formatOnPaste: false,
                            contextmenu: false,
                            padding: { top: 8 },
                            lineNumbersMinChars: 3,
                        }}
                    />
                </div>

                <div className="h-px shrink-0 bg-black/60" />

                {/* Terminal / Problems */}
                <div className="flex-1 min-h-0 flex flex-col bg-[#1e1e1e]">
                    <div className="h-8 shrink-0 flex items-center gap-1 px-2 border-b border-black/40 bg-[#2b2b2b] text-xs">
                        <button onClick={() => setTab('terminal')} className={`flex items-center gap-1.5 px-2.5 h-full border-b-2 ${tab === 'terminal' ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                            <TermIcon size={12} /> Terminal
                        </button>
                        <button onClick={() => setTab('problems')} className={`flex items-center gap-1.5 px-2.5 h-full border-b-2 ${tab === 'problems' ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                            <AlertCircle size={12} className={errors.length ? 'text-red-400' : ''} /> Problems
                            {markers.length > 0 && <span className="px-1.5 rounded bg-red-500/80 text-white text-[10px]">{markers.length}</span>}
                        </button>
                        <button onClick={() => setLines([])} title="Tozalash" className="ml-auto text-gray-500 hover:text-white p-1"><Eraser size={13} /></button>
                    </div>

                    <div ref={termRef} className="flex-1 min-h-0 overflow-auto p-2.5 font-mono text-xs leading-relaxed select-text">
                        {tab === 'terminal' ? (
                            lines.length === 0 && !ask ? (
                                <p className="text-gray-600">
                                    {language === 'python' && pyState === 'loading' ? 'Python muhiti yuklanmoqda…' : 'Run bosing yoki Ctrl+Enter. Natija shu yerda chiqadi.'}
                                </p>
                            ) : lines.map((l, i) => (
                                <pre key={i} className={`whitespace-pre-wrap break-words ${color[l.stream] || 'text-gray-200'}`}>{l.text}</pre>
                            ))
                        ) : markers.length === 0 ? (
                            <p className="text-green-400 flex items-center gap-1.5"><CheckCircle2 size={13} /> Xato topilmadi</p>
                        ) : markers.map((m, i) => (
                            <button key={i} onClick={() => { editorRef.current?.revealLineInCenter(m.startLineNumber); editorRef.current?.setPosition({ lineNumber: m.startLineNumber, column: m.startColumn }); editorRef.current?.focus(); }}
                                className="w-full text-left flex items-start gap-2 py-1 hover:bg-white/5 rounded px-1">
                                <XCircle size={13} className={`shrink-0 mt-0.5 ${m.severity === 8 ? 'text-red-400' : 'text-yellow-400'}`} />
                                <span className="text-gray-200">{m.message}</span>
                                <span className="ml-auto text-gray-500 shrink-0">{FILE[language]}:{m.startLineNumber}:{m.startColumn}</span>
                            </button>
                        ))}
                        {tab === 'terminal' && ask && (
                            <form onSubmit={(e) => { e.preventDefault(); answer(typed); }} className="flex items-center gap-1.5 text-gray-200">
                                {ask.prompt && <span className="whitespace-pre-wrap">{ask.prompt}</span>}
                                <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false}
                                    placeholder="yozing va Enter bosing"
                                    className="flex-1 min-w-0 bg-transparent outline-none border-b border-blue-500 text-white placeholder:text-gray-600" />
                                <button type="button" onClick={() => answer(null)} className="shrink-0 text-gray-500 hover:text-red-400">To&apos;xtatish</button>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* Status bar */}
            <div className="h-6 shrink-0 flex items-center gap-4 px-3 bg-[#2b2b2b] border-t border-black/40 text-[11px] text-gray-400">
                <span className={errors.length ? 'text-red-400' : 'text-green-400'}>
                    {errors.length ? `${errors.length} ta xato` : '✓ Xato yo\'q'}
                </span>
                {language === 'python' && pyState === 'loading' && <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Python yuklanmoqda</span>}
                {language === 'python' && pyState === 'failed' && <span className="text-red-400">Python yuklanmadi (internet?)</span>}
                <span className="ml-auto">Ln {pos.ln}, Col {pos.col}</span>
                <span>{LABEL[language]}</span>
                <span>UTF-8</span>
                <span>{language === 'python' ? '4 bo\'sh joy' : '2 bo\'sh joy'}</span>
            </div>
        </div>
    );
}

// Brauzerda kod ishga tushirish: JavaScript (Web Worker) va Python (Pyodide, Web Worker).
// Ikkalasi ham sahifadan ajratilgan: DOM, cookie va localStorage'ga kira olmaydi.

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';

const deepEqualSrc = `
function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(k => deepEqual(a[k], b[k]));
}
`;

// ───────────────────────── JavaScript ─────────────────────────
const JS_WORKER_SRC = deepEqualSrc + `
const out = (stream, text) => self.postMessage({ type: 'out', stream, text });
const fmt = (args) => args.map(x => {
    if (typeof x === 'string') return x;
    try { const s = JSON.stringify(x, null, 2); return s === undefined ? String(x) : s; } catch (e) { return String(x); }
}).join(' ');
console.log = (...a) => out('out', fmt(a));
console.info = console.log;
console.debug = console.log;
console.warn = (...a) => out('err', fmt(a));
console.error = (...a) => out('err', fmt(a));
const AsyncFunction = (async function () {}).constructor;

self.onmessage = async (e) => {
    const m = e.data;
    if (m.mode === 'run') {
        try { await new AsyncFunction(m.code)(); }
        catch (err) { out('err', (err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err))); }
        self.postMessage({ type: 'done' });
        return;
    }
    let fn;
    try {
        fn = new Function(m.code + '\\n;return typeof ' + m.functionName + ' === "function" ? ' + m.functionName + ' : undefined;')();
    } catch (err) {
        self.postMessage({ type: 'fatal', error: String(err && err.message || err) });
        return;
    }
    if (!fn) { self.postMessage({ type: 'fatal', error: 'Funksiya topilmadi: ' + m.functionName }); return; }
    for (let i = 0; i < m.testCases.length; i++) {
        const t = m.testCases[i];
        try {
            const got = await fn.apply(null, JSON.parse(JSON.stringify(t.args || [])));
            self.postMessage({ type: 'case', i, ok: deepEqual(got, t.expected), got: JSON.stringify(got) });
        } catch (err) {
            self.postMessage({ type: 'case', i, ok: false, got: 'Xato: ' + String(err && err.message || err) });
        }
    }
    self.postMessage({ type: 'done' });
};
`;

function runInJsWorker(payload, { onMsg, idleMs, totalMs }) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(new Blob([JS_WORKER_SRC], { type: 'text/javascript' }));
        const worker = new Worker(url);
        let idle, total;
        const finish = (extra = {}) => {
            clearTimeout(idle); clearTimeout(total);
            worker.terminate(); URL.revokeObjectURL(url);
            resolve(extra);
        };
        const armIdle = () => { if (!idleMs) return; clearTimeout(idle); idle = setTimeout(() => finish({ timedOut: true }), idleMs); };
        if (totalMs) total = setTimeout(() => finish({ timedOut: true }), totalMs);
        worker.onmessage = (e) => {
            const m = e.data;
            if (m.type === 'done') return finish();
            if (m.type === 'fatal') return finish({ fatal: m.error });
            armIdle();
            onMsg?.(m);
        };
        worker.onerror = (e) => finish({ fatal: e.message || 'Xato' });
        armIdle();
        worker.postMessage(payload);
    });
}

// ───────────────────────── Python (Pyodide) ─────────────────────────
const PY_HELPERS = `
import json
def _chk(src):
    try:
        compile(src, 'main.py', 'exec')
        return None
    except SyntaxError as e:
        return json.dumps({'line': e.lineno or 1, 'col': e.offset or 1, 'msg': e.msg})
def _call(fn, a):
    return json.dumps(fn(*json.loads(a)))
`;

const PY_WORKER_BODY = `
importScripts(${JSON.stringify(PYODIDE_URL)});
let pyodide;
const ready = (async () => {
    pyodide = await loadPyodide();
    pyodide.runPython(HELPERS);
    self.postMessage({ type: 'ready' });
})().catch(err => { self.postMessage({ type: 'init-error', error: String(err && err.message || err) }); throw err; });

function clean(msg) {
    const lines = String(msg).split('\\n');
    const i = lines.findIndex(l => l.indexOf('File "<exec>"') !== -1);
    const body = i >= 0 ? lines.slice(i) : lines.slice(-2);
    return 'Traceback (most recent call last):\\n' + body.join('\\n').split('<exec>').join('main.py');
}
function lastLine(msg) {
    const l = String(msg).trim().split('\\n');
    return l[l.length - 1];
}

self.onmessage = async (e) => {
    const m = e.data;
    try { await ready; } catch (err) { return; }
    const post = (o) => self.postMessage(Object.assign({ id: m.id }, o));
    try {
        if (m.mode === 'check') {
            pyodide.globals.set('_src', m.code);
            const r = pyodide.runPython('_chk(_src)');
            post({ type: 'result', result: r || null });
            return;
        }
        pyodide.setStdout({ batched: (s) => post({ type: 'out', stream: 'out', text: s }) });
        pyodide.setStderr({ batched: (s) => post({ type: 'out', stream: 'err', text: s }) });
        const ns = pyodide.globals.get('dict')();
        if (m.mode === 'run') {
            try { pyodide.runPython(m.code, { globals: ns }); }
            catch (err) { post({ type: 'out', stream: 'err', text: clean(err.message) }); }
            ns.destroy();
            post({ type: 'done' });
            return;
        }
        // test rejimi
        try { pyodide.runPython(m.code, { globals: ns }); }
        catch (err) { ns.destroy(); post({ type: 'fatal', error: lastLine(err.message) }); return; }
        const fn = ns.get(m.functionName);
        if (!fn) { ns.destroy(); post({ type: 'fatal', error: 'Funksiya topilmadi: ' + m.functionName }); return; }
        const call = pyodide.globals.get('_call');
        for (let i = 0; i < m.testCases.length; i++) {
            const t = m.testCases[i];
            try {
                const s = call(fn, JSON.stringify(t.args || []));
                post({ type: 'case', i, ok: deepEqual(JSON.parse(s), t.expected), got: s });
            } catch (err) {
                post({ type: 'case', i, ok: false, got: 'Xato: ' + lastLine(err.message) });
            }
        }
        ns.destroy();
        post({ type: 'done' });
    } catch (err) {
        post({ type: 'fatal', error: lastLine(err.message || err) });
    }
};
`;

let pyWorker = null;
let pyReady = null;
let seq = 0;
const pending = new Map();

function startPy() {
    if (pyWorker) return pyReady;
    const src = deepEqualSrc + 'const HELPERS = ' + JSON.stringify(PY_HELPERS) + ';\n' + PY_WORKER_BODY;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    pyWorker = w;
    pyReady = new Promise((resolve, reject) => {
        w.onmessage = (e) => {
            const m = e.data;
            if (m.type === 'ready') return resolve();
            if (m.type === 'init-error') { reset(w); return reject(new Error(m.error)); }
            pending.get(m.id)?.(m);
        };
        w.onerror = (e) => { reset(w); reject(new Error(e.message || 'Python yuklanmadi')); };
    });
    pyReady.catch(() => {});
    return pyReady;
}

function reset(w) {
    try { w.terminate(); } catch {}
    if (pyWorker === w) { pyWorker = null; pyReady = null; }
    pending.clear();
}

/** Python muhitini oldindan yuklaydi (~10 MB, bir marta). */
export function preloadPython() {
    return startPy();
}

function callPy(msg, { onMsg, idleMs, totalMs } = {}) {
    return new Promise(async (resolve) => {
        try { await startPy(); }
        catch (e) { return resolve({ fatal: "Python muhiti yuklanmadi (internetni tekshiring): " + e.message }); }
        const w = pyWorker;
        const id = ++seq;
        let idle, total, done = false;
        const finish = (extra = {}) => {
            if (done) return; done = true;
            clearTimeout(idle); clearTimeout(total);
            pending.delete(id);
            resolve(extra);
        };
        const timeout = () => { reset(w); finish({ timedOut: true }); }; // worker o'chiriladi, keyingi chaqiruvda qayta yuklanadi
        const armIdle = () => { if (!idleMs) return; clearTimeout(idle); idle = setTimeout(timeout, idleMs); };
        if (totalMs) total = setTimeout(timeout, totalMs);
        pending.set(id, (m) => {
            if (m.type === 'done') return finish();
            if (m.type === 'fatal') return finish({ fatal: m.error });
            if (m.type === 'result') return finish({ result: m.result });
            armIdle();
            onMsg?.(m);
        });
        armIdle();
        w.postMessage({ id, ...msg });
    });
}

// ───────────────────────── Umumiy API ─────────────────────────

/** Python sintaksis xatosini qaytaradi: null yoki { line, col, msg } */
export async function checkPythonSyntax(code) {
    const r = await callPy({ mode: 'check', code }, { idleMs: 5000 });
    if (r.result) { try { return JSON.parse(r.result); } catch {} }
    return null;
}

/** Kodni oddiy skript sifatida ishga tushiradi, chiqishni onLine({stream,text}) orqali beradi. */
export async function runProgram({ language, code, onLine }) {
    const onMsg = (m) => { if (m.type === 'out') onLine({ stream: m.stream, text: m.text }); };
    const r = language === 'python'
        ? await callPy({ mode: 'run', code }, { onMsg, totalMs: 10000 })
        : await runInJsWorker({ mode: 'run', code }, { onMsg, totalMs: 5000 });
    if (r.timedOut) onLine({ stream: 'err', text: "Vaqt tugadi: dastur juda uzoq ishladi (cheksiz sikl?)" });
    if (r.fatal) onLine({ stream: 'err', text: r.fatal });
}

/**
 * Funksiyani test-case'lar bilan tekshiradi.
 * @returns {Promise<{ passed:number, total:number, results:{ok:boolean,got:string}[], error?:string }>}
 */
export async function runTests({ language, code, functionName, testCases }) {
    const total = testCases.length;
    const results = Array.from({ length: total }, () => ({ ok: false, got: 'Bajarilmadi' }));
    const onMsg = (m) => { if (m.type === 'case') results[m.i] = { ok: m.ok, got: m.got }; };
    const payload = { mode: 'test', code, functionName, testCases };
    const r = language === 'python'
        ? await callPy(payload, { onMsg, idleMs: 4000 })
        : await runInJsWorker(payload, { onMsg, idleMs: 3000 });
    const error = r.fatal || (r.timedOut ? "Vaqt tugadi (cheksiz sikl bo'lishi mumkin)" : undefined);
    return { passed: results.filter(x => x.ok).length, total, results, error };
}

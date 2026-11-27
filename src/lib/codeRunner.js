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
const out = (stream, text) => { if (!waiting) self.postMessage({ type: 'out', stream, text }); };
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

// input: prompt() yoki require('prompt-sync' / 'readline-sync')
const NEED_INPUT = {};
let queue = [];
let waiting = false;
self.prompt = (q = '') => {
    if (!queue.length) {
        if (!waiting) { self.postMessage({ type: 'need-input', prompt: String(q) }); waiting = true; }
        throw NEED_INPUT;
    }
    const v = queue.shift();
    out('out', String(q) + v);
    return v;
};
const MODULES = {
    'prompt-sync': () => self.prompt,
    'readline-sync': {
        question: (q) => self.prompt(q),
        prompt: () => self.prompt(),
        questionInt: (q) => parseInt(self.prompt(q), 10),
        questionFloat: (q) => parseFloat(self.prompt(q)),
    },
};
const has = (name) => Object.prototype.hasOwnProperty.call(MODULES, name);
self.require = (name) => {
    if (has(name)) return MODULES[name];
    throw new Error("require('" + name + "') brauzerda ishlamaydi. import ... from ishlating.");
};
const load = async (name) => {
    if (has(name)) return Object.assign({ default: MODULES[name] }, MODULES[name]);
    if (name.startsWith('node:') || ['fs', 'path', 'os', 'readline', 'http', 'child_process'].includes(name)) {
        throw new Error("'" + name + "' Node.js moduli, brauzerda ishlamaydi");
    }
    return import(name.startsWith('https://') ? name : 'https://cdn.jsdelivr.net/npm/' + name + '/+esm');
};

self.onmessage = async (e) => {
    const m = e.data;
    if (m.mode === 'run') {
        queue = (m.inputs || []).slice();
        // qayta ishga tushirishda tasodifiy sonlar o'zgarmasligi uchun
        let seed = m.seed >>> 0;
        Math.random = () => {
            seed = (seed + 0x6D2B79F5) >>> 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        try { await new AsyncFunction('__import', m.code)(load); }
        catch (err) { if (err !== NEED_INPUT) out('err', (err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err))); }
        self.postMessage({ type: 'done' });
        return;
    }
    let fn;
    try {
        fn = await new AsyncFunction('__import', m.code + '\\n;return typeof ' + m.functionName + ' === "function" ? ' + m.functionName + ' : undefined;')(load);
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
import json, sys, random
class _NeedInput(BaseException):
    pass
def _prepare(ns, inputs_json, seed, on_need):
    queue = json.loads(inputs_json)
    asked = []
    random.seed(seed)
    def _input(prompt=''):
        sys.stdout.flush()
        if not queue:
            if not asked:
                asked.append(True)
                on_need(str(prompt))
            raise _NeedInput()
        value = queue.pop(0)
        print(str(prompt) + value)
        return value
    ns['__name__'] = '__main__'
    ns['input'] = _input
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
        if (m.mode === 'load') {
            // import qilingan paketlarni (numpy, pandas va h.k.) yuklab olish
            await pyodide.loadPackagesFromImports(m.code);
            post({ type: 'done' });
            return;
        }
        let waiting = false;
        const out = (stream, text) => { if (!waiting) post({ type: 'out', stream, text }); };
        pyodide.setStdout({ batched: (s) => out('out', s) });
        pyodide.setStderr({ batched: (s) => out('err', s) });
        const ns = pyodide.globals.get('dict')();
        const prepare = pyodide.globals.get('_prepare');
        prepare(ns, JSON.stringify(m.inputs || []), m.seed || 0, (q) => { post({ type: 'need-input', prompt: q }); waiting = true; });
        prepare.destroy();
        if (m.mode === 'run') {
            try { pyodide.runPython(m.code, { globals: ns }); }
            catch (err) { out('err', clean(err.message)); }
            pyodide.runPython('import sys; sys.stdout.flush()');
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
// Worker input kutib to'xtab tura olmaydi (buning uchun COOP/COEP sarlavhalari kerak). Shuning uchun
// har yangi javobdan keyin dastur boshidan ishga tushiriladi va oldin chiqqan qatorlar takrorlanmaydi.
export async function runProgram({ language, code, onLine, onInput }) {
    const isPy = language === 'python';
    const src = isPy ? code : prepareJs(code);
    if (isPy && /^\s*(import|from)\s/m.test(code)) {
        const l = await callPy({ mode: 'load', code }, { totalMs: 60000 });
        if (l.timedOut || l.fatal) {
            onLine({ stream: 'err', text: l.fatal || "Paketlarni yuklab bo'lmadi (internetni tekshiring)" });
            return;
        }
    }
    const jsLimit = src !== code ? 20000 : 5000; // import internetdan yuklanadi
    const seed = Math.floor(Math.random() * 1e9);
    const inputs = [];
    let shown = 0;
    while (true) {
        let count = 0;
        let question = null;
        const onMsg = (m) => {
            if (m.type === 'need-input') question = m.prompt;
            else if (m.type === 'out' && ++count > shown) onLine({ stream: m.stream, text: m.text });
        };
        const payload = { mode: 'run', code: src, inputs, seed };
        const r = isPy
            ? await callPy(payload, { onMsg, totalMs: 10000 })
            : await runInJsWorker(payload, { onMsg, totalMs: jsLimit });
        if (question === null) {
            if (r.timedOut) onLine({ stream: 'err', text: "Vaqt tugadi: dastur juda uzoq ishladi (cheksiz sikl?)" });
            if (r.fatal) onLine({ stream: 'err', text: r.fatal });
            return;
        }
        shown = Math.max(shown, count);
        const value = onInput && inputs.length < 200 ? await onInput(question) : null;
        if (value === null) return;
        inputs.push(value);
    }
}

// "import ... from" ni funksiya ichida ishlaydigan ko'rinishga o'tkazadi
function prepareJs(code) {
    return code
        .replace(/^[ \t]*import(?![\w$(.])\s*(?:([\w$\s{},*]+?)\s*from\s*)?(['"])([^'"\n]+)\2[ \t]*;?/gm, (all, clause, quote, name) => {
            const load = `await __import(${JSON.stringify(name)})`;
            if (!clause) return `${load};`;
            const star = clause.match(/\*\s*as\s+([\w$]+)/);
            const braces = clause.match(/\{([^}]*)\}/);
            const def = clause.match(/^\s*([\w$]+)/);
            const parts = [];
            if (def) parts.push(`const ${def[1]} = (${load}).default;`);
            if (star) parts.push(`const ${star[1]} = ${load};`);
            if (braces) parts.push(`const {${braces[1].replace(/([\w$]+)\s+as\s+([\w$]+)/g, '$1: $2')}} = ${load};`);
            return parts.join(' ');
        })
        .replace(/^[ \t]*export\s+(default\s+)?(?=(async\s+)?(function|class|const|let|var)\b)/gm, '');
}

/**
 * Funksiyani test-case'lar bilan tekshiradi.
 * `logs` — shu test paytida console.log / print orqali chiqqan qatorlar.
 * @returns {Promise<{ passed:number, total:number, results:{ok:boolean,got:string,logs:{stream:string,text:string}[]}[], error?:string }>}
 */
export async function runTests({ language, code, functionName, testCases }) {
    const total = testCases.length;
    const results = Array.from({ length: total }, () => ({ ok: false, got: 'Bajarilmadi', logs: [] }));
    // Chiqish har doim o'z testining natijasidan oldin keladi
    let logs = [];
    let finished = 0;
    const onMsg = (m) => {
        if (m.type === 'out' && logs.length < 100) logs.push({ stream: m.stream, text: String(m.text).slice(0, 2000) });
        if (m.type === 'case') {
            results[m.i] = { ok: m.ok, got: m.got, logs };
            logs = [];
            finished = m.i + 1;
        }
    };
    if (language === 'python') await callPy({ mode: 'load', code }, { totalMs: 60000 });
    const payload = { mode: 'test', code: language === 'python' ? code : prepareJs(code), functionName, testCases };
    const r = language === 'python'
        // totalMs: to'xtovsiz chop etadigan sikl "idle" cheklovidan o'tib ketmasligi uchun
        ? await callPy(payload, { onMsg, idleMs: 4000, totalMs: 30000 })
        : await runInJsWorker(payload, { onMsg, idleMs: 3000, totalMs: 20000 });
    // To'xtab qolgan testning chiqishi ham yo'qolmasin
    if (finished < total) results[finished].logs = logs;
    const error = r.fatal || (r.timedOut ? "Vaqt tugadi (cheksiz sikl bo'lishi mumkin)" : undefined);
    return { passed: results.filter(x => x.ok).length, total, results, error };
}

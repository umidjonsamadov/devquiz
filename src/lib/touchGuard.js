// Telefondagi urinishlar. Matn belgilash o'chirilgani uchun "copy" hodisasi sodir bo'lmaydi,
// shuning uchun harakatning o'zi kuzatiladi. Ikkalasi ham gumon: aniq dalil emas.
// Telefonning tugmalar bilan olingan screenshot'i haqida brauzerga hech qanday signal kelmaydi.

const HOLD_MS = 700;      // shuncha vaqt qimirlatmay bosib turilsa
const MOVE_LIMIT = 10;    // px: bundan ko'p surilsa, bu sahifani aylantirish
const HIDE_MS = 1500;
// Tugma, havola va o'quvchining o'z matni ustida bosib turish sanalmaydi
const IGNORE = 'button, a, input, textarea, select, label, [contenteditable="true"], .monaco-editor, [data-ide]';

const element = (node) => (node?.nodeType === 1 ? node : node?.parentElement);

/**
 * onAttempt(type, method, target) — urinish aniqlanganda chaqiriladi.
 * Bosib turish faqat [data-guard-zone] ichida (savol turgan joyda) sanaladi.
 * @returns tozalash funksiyasi
 */
export function watchTouch(onAttempt) {
    let timer = null, start = null, hideTimer = null;
    const cancel = () => { clearTimeout(timer); timer = null; };

    const onStart = (e) => {
        cancel();
        // 3 barmoq: ko'p Android telefonlarda screenshot imo-ishorasi. Mazmun darhol xiralashtiriladi
        if (e.touches.length >= 3) {
            document.body.classList.add('guard-hidden');
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => document.body.classList.remove('guard-hidden'), HIDE_MS);
            onAttempt('screenshot', 'three-finger', e.target);
            return;
        }
        if (e.touches.length !== 1) return;
        const node = element(e.target);
        if (!node?.closest?.('[data-guard-zone]') || node.closest(IGNORE)) return;
        const { clientX, clientY } = e.touches[0];
        start = { x: clientX, y: clientY };
        timer = setTimeout(() => onAttempt('copy', 'long-press', e.target), HOLD_MS);
    };
    const onMove = (e) => {
        const t = e.touches[0];
        if (timer && t && Math.hypot(t.clientX - start.x, t.clientY - start.y) > MOVE_LIMIT) cancel();
    };

    const options = { capture: true, passive: true };
    const listeners = [['touchstart', onStart], ['touchmove', onMove], ['touchend', cancel], ['touchcancel', cancel], ['scroll', cancel]];
    listeners.forEach(([name, handler]) => document.addEventListener(name, handler, options));
    return () => {
        cancel();
        clearTimeout(hideTimer);
        listeners.forEach(([name, handler]) => document.removeEventListener(name, handler, options));
    };
}

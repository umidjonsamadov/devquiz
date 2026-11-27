'use client';

import { useEffect, useRef } from 'react';
import { reportViolation } from './violations';
import { watchTouch } from './touchGuard';

// O'quvchining o'z kodi va yozgan matni: bu yerlarda nusxalash erkin
const OWN_TEXT = 'input, textarea, [contenteditable="true"], .monaco-editor';
const isOwnText = (target) => !!(target?.nodeType === 1 ? target : target?.parentElement)?.closest?.(OWN_TEXT);
const SHORTCUT_BLUR_MS = 1500;
const MODIFIERS = ['Control', 'Shift', 'Meta'];
const CAPTURE_CODES = /^(KeyS|Digit[345])$/;

/**
 * Savol sahifasida nusxalashni to'sadi va nusxalash/screenshot urinishlarini yashirin qayd qiladi.
 * Brauzer screenshot'ni to'liq to'sa olmaydi: telefon va tashqi kamera umuman sezilmaydi.
 * getItem(target) — hozir ekrandagi yoki ustiga oxirgi bosilgan savol: { source, itemId, context }
 */
export default function useContentGuard(active, getItem) {
    const itemRef = useRef(getItem);
    useEffect(() => { itemRef.current = getItem; });

    useEffect(() => {
        if (!active) return;
        let pointed = null; // sichqoncha yoki barmoq oxirgi tegkan element
        const report = (type, method, target = pointed) => reportViolation({ ...itemRef.current(target), type, method });
        const onPoint = (e) => {
            pointed = e.target;
            if (e.type === 'pointerdown') document.body.classList.remove('guard-latched');
        };
        const stopTouch = watchTouch(report);
        // Ctrl+Shift / Win+Shift bosilgan payt: oyna fokusi ketsa, screenshot vositasi ochilgan deb gumon qilinadi
        let armed = null;
        // Mazmun shu zahoti xiralashadi va sahifaga bosilguncha yoki yozishda davom etilguncha shunday qoladi
        const hide = () => document.body.classList.add('guard-latched');
        const reveal = () => document.body.classList.remove('guard-latched');

        const onCopy = (e) => {
            if (isOwnText(e.target)) return;
            e.preventDefault();
            report('copy', e.type === 'cut' ? 'cut' : 'copy');
        };
        const block = (e) => { if (!isOwnText(e.target)) e.preventDefault(); };
        // PrintScreen rasmni clipboard'ga qo'ygan bo'lsa, ustidan bo'sh matn yoziladi
        const screenshot = (method) => {
            navigator.clipboard?.writeText(' ').catch(() => {});
            report('screenshot', method);
        };
        const onKeyDown = (e) => {
            const command = e.ctrlKey || e.metaKey;
            // Ctrl+Shift+S'dagi "S" brauzer yoki screenshot dasturida qolib ketishi mumkin, lekin Ctrl va Shift
            // sahifaga undan oldin keladi. Shuning uchun savol "S" bosilishidan oldin yashiriladi.
            // Boshqa tugma kelsa (kod tahrirlash: Ctrl+Shift+o'q, K, ...) darhol qaytariladi
            if (command && e.shiftKey && (MODIFIERS.includes(e.key) || CAPTURE_CODES.test(e.code))) {
                hide();
                armed = { at: Date.now(), method: e.metaKey ? 'win-shift' : 'ctrl-shift' };
            } else if (e.key !== 'PrintScreen' && !MODIFIERS.includes(e.key)) {
                reveal();
                armed = null;
            }
            if (e.key === 'PrintScreen') screenshot('printscreen');
            else if (e.shiftKey && ((e.metaKey && /^(KeyS|Digit[345])$/.test(e.code)) || (e.ctrlKey && e.code === 'KeyS' && !isOwnText(e.target)))) {
                e.preventDefault();
                screenshot('shortcut');
            } else if (command && e.code === 'KeyP') {
                e.preventDefault();
                report('screenshot', 'print');
            } else if (command && e.code === 'KeyS') e.preventDefault(); // sahifani saqlab olish
        };
        const onKeyUp = (e) => { if (e.key === 'PrintScreen') screenshot('printscreen'); };
        // Oyna fokusda bo'lmaganda (screenshot vositasi ochilganda) mazmun xiralashadi
        // Capture bosqichida elementlarning blur/focus'i ham keladi, bizga faqat oynaniki kerak
        const onBlur = (e) => {
            if (e.target !== window) return;
            document.body.classList.add('guard-hidden');
            if (armed && Date.now() - armed.at < SHORTCUT_BLUR_MS) report('screenshot', armed.method);
            armed = null;
        };
        const onFocus = (e) => { if (e.target === window) document.body.classList.remove('guard-hidden'); };
        const onPrint = () => report('screenshot', 'print');

        const listeners = [
            [document, 'pointerdown', onPoint], [document, 'pointerover', onPoint],
            [document, 'copy', onCopy], [document, 'cut', onCopy],
            [document, 'contextmenu', block], [document, 'dragstart', block],
            [window, 'keydown', onKeyDown], [window, 'keyup', onKeyUp],
            [window, 'blur', onBlur], [window, 'focus', onFocus], [window, 'beforeprint', onPrint],
        ];
        listeners.forEach(([target, name, handler]) => target.addEventListener(name, handler, true));
        document.body.classList.add('guard-on');
        window.getSelection()?.removeAllRanges();

        return () => {
            stopTouch();
            listeners.forEach(([target, name, handler]) => target.removeEventListener(name, handler, true));
            document.body.classList.remove('guard-on', 'guard-hidden', 'guard-latched');
        };
    }, [active]);
}

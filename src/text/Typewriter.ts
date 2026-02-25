import type { TypewriterConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

export function Typewriter(config: TypewriterConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const speed = config.speed ?? 50;
    const showCursor = config.cursor ?? true;
    const cursorChar = config.cursorChar ?? '|';
    const loop = config.loop ?? true;
    const startDelay = config.startDelay ?? 0;

    const originalHTML = element.innerHTML;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let cursorInterval: ReturnType<typeof setInterval> | null = null;
    let cursorSpan: HTMLSpanElement | null = null;
    let destroyed = false;

    function clear() {
        if (timerId !== null) { clearTimeout(timerId); timerId = null; }
        if (cursorInterval !== null) { clearInterval(cursorInterval); cursorInterval = null; }
    }

    function type() {
        let i = 0;
        element.textContent = '';

        if (showCursor) {
            cursorSpan = document.createElement('span');
            cursorSpan.textContent = cursorChar;
            cursorSpan.style.display = 'inline';
            cursorInterval = setInterval(() => {
                if (cursorSpan) cursorSpan.style.opacity = cursorSpan.style.opacity === '0' ? '1' : '0';
            }, 530);
        }

        function tick() {
            if (destroyed) return;
            if (i <= text.length) {
                element.textContent = text.slice(0, i);
                if (cursorSpan) element.appendChild(cursorSpan);
                i++;
                timerId = setTimeout(tick, speed);
            } else if (loop) {
                timerId = setTimeout(() => {
                    i = 0;
                    tick();
                }, speed * 10);
            }
        }

        timerId = setTimeout(tick, startDelay);
    }

    return {
        play() {
            if (destroyed) return;
            clear();
            type();
        },
        reset() {
            if (destroyed) return;
            clear();
            element.innerHTML = originalHTML;
        },
        destroy() {
            destroyed = true;
            clear();
            element.innerHTML = originalHTML;
        },
    };
}

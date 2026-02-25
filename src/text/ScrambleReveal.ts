import type { ScrambleRevealConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

export function ScrambleReveal(config: ScrambleRevealConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const speed = config.speed ?? 30;
    const scrambleChars = config.scrambleChars ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const stagger = config.stagger ?? 40;
    const iterations = config.iterations ?? 8;

    const originalHTML = element.innerHTML;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let destroyed = false;

    function randomChar(): string {
        return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
    }

    function scramble() {
        const chars: string[] = new Array(text.length).fill('');
        let resolvedCount = 0;
        const totalToResolve = text.split('').filter(c => c !== ' ').length;

        // Initialize all positions with random chars
        for (let i = 0; i < text.length; i++) {
            chars[i] = text[i] === ' ' ? ' ' : randomChar();
        }
        element.textContent = chars.join('');

        // Stagger each character's resolve
        for (let i = 0; i < text.length; i++) {
            if (text[i] === ' ') {
                continue;
            }

            const charDelay = i * stagger;
            let iter = 0;

            function tickChar(idx: number) {
                if (destroyed) return;
                iter++;
                if (iter >= iterations) {
                    chars[idx] = text[idx];
                    element.textContent = chars.join('');
                    resolvedCount++;

                    // All characters resolved — loop after a pause
                    if (resolvedCount >= totalToResolve) {
                        timers.push(setTimeout(() => {
                            if (!destroyed) scramble();
                        }, 2000));
                    }
                } else {
                    chars[idx] = randomChar();
                    element.textContent = chars.join('');
                    timers.push(setTimeout(() => tickChar(idx), speed));
                }
            }

            timers.push(setTimeout(() => tickChar(i), charDelay));
        }
    }

    function clearTimers() {
        timers.forEach(clearTimeout);
        timers = [];
    }

    return {
        play() {
            if (destroyed) return;
            clearTimers();
            scramble();
        },
        reset() {
            if (destroyed) return;
            clearTimers();
            element.innerHTML = originalHTML;
        },
        destroy() {
            destroyed = true;
            clearTimers();
            element.innerHTML = originalHTML;
        },
    };
}

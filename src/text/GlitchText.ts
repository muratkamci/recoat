import type { GlitchTextConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

export function GlitchText(config: GlitchTextConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const speed = config.speed ?? 50;
    const intensity = config.intensity ?? 0.3;
    const glitchChars = config.glitchChars ?? '!@#$%^&*<>[]{}|/\\~';
    const color = config.color ?? '#00ff41';

    const originalHTML = element.innerHTML;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cycleTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function randomChar(): string {
        return glitchChars[Math.floor(Math.random() * glitchChars.length)];
    }

    function render() {
        let html = '';
        for (let i = 0; i < text.length; i++) {
            if (text[i] === ' ') {
                html += ' ';
            } else if (Math.random() < intensity) {
                html += `<span style="color:${color}">${randomChar()}</span>`;
            } else {
                html += text[i];
            }
        }
        element.innerHTML = html;
    }

    function showNormal() {
        element.textContent = text;
    }

    function cycle() {
        if (destroyed) return;

        // Glitch burst for ~800ms
        render();
        intervalId = setInterval(render, speed);

        cycleTimer = setTimeout(() => {
            if (destroyed) return;
            if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
            showNormal();

            // Normal pause for 1.5s, then restart
            cycleTimer = setTimeout(() => cycle(), 1500);
        }, 800);
    }

    function clearAll() {
        if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
        if (cycleTimer !== null) { clearTimeout(cycleTimer); cycleTimer = null; }
    }

    return {
        play() {
            if (destroyed) return;
            clearAll();
            cycle();
        },
        reset() {
            if (destroyed) return;
            clearAll();
            element.innerHTML = originalHTML;
        },
        destroy() {
            destroyed = true;
            clearAll();
            element.innerHTML = originalHTML;
        },
    };
}

import type { WavyBounceConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

export function WavyBounce(config: WavyBounceConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const amplitude = config.amplitude ?? 12;
    const speed = config.speed ?? 1;
    const stagger = config.stagger ?? 0.3;
    const color = config.color ?? '#ffffff';

    const originalHTML = element.innerHTML;
    const origStyle = element.getAttribute('style') || '';

    let animationId: number | null = null;
    let destroyed = false;
    let time = 0;
    const charSpans: HTMLSpanElement[] = [];

    function setup() {
        element.innerHTML = '';
        element.style.display = 'inline-block';
        element.style.whiteSpace = 'nowrap';
        charSpans.length = 0;

        for (let i = 0; i < text.length; i++) {
            const span = document.createElement('span');
            span.textContent = text[i] === ' ' ? '\u00A0' : text[i];
            span.style.display = 'inline-block';
            span.style.color = color;
            span.style.willChange = 'transform';
            element.appendChild(span);
            charSpans.push(span);
        }
    }

    function animate() {
        if (destroyed) return;

        time += 0.016 * speed;

        for (let i = 0; i < charSpans.length; i++) {
            const y = Math.sin(time * 3 - i * stagger) * amplitude;
            charSpans[i].style.transform = `translateY(${y}px)`;
        }

        animationId = requestAnimationFrame(animate);
    }

    function cleanup() {
        if (animationId !== null) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    return {
        play() {
            if (destroyed) return;
            cleanup();
            setup();
            time = 0;
            animate();
        },
        reset() {
            if (destroyed) return;
            cleanup();
            element.innerHTML = originalHTML;
            element.setAttribute('style', origStyle);
        },
        destroy() {
            destroyed = true;
            cleanup();
            element.innerHTML = originalHTML;
            element.setAttribute('style', origStyle);
        },
    };
}

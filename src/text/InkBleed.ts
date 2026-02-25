import type { InkBleedConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

export function InkBleed(config: InkBleedConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const color = config.color ?? '#ffffff';
    const speed = config.speed ?? 1;
    const staggerDelay = config.stagger ?? 120;
    const spread = config.spread ?? 1;
    const holdDuration = config.holdDuration ?? 2000;

    const originalHTML = element.innerHTML;
    const origStyle = element.getAttribute('style') || '';

    let animationId: number | null = null;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const charSpans: HTMLSpanElement[] = [];

    interface CharState {
        progress: number; // 0 = hidden, 1 = fully visible
        started: boolean;
        done: boolean;
    }

    let states: CharState[] = [];

    function setup() {
        element.innerHTML = '';
        element.style.display = 'inline-block';
        element.style.whiteSpace = 'nowrap';
        charSpans.length = 0;
        states = [];

        for (let i = 0; i < text.length; i++) {
            const span = document.createElement('span');
            span.textContent = text[i] === ' ' ? '\u00A0' : text[i];
            span.style.display = 'inline-block';
            span.style.color = color;
            span.style.willChange = 'clip-path, filter';
            // Start fully hidden with ink blot clip
            span.style.clipPath = 'circle(0% at 50% 50%)';
            span.style.filter = 'blur(4px)';
            element.appendChild(span);
            charSpans.push(span);
            states.push({ progress: 0, started: false, done: false });
        }
    }

    function animate() {
        if (destroyed) return;

        let allDone = true;

        for (let i = 0; i < charSpans.length; i++) {
            const s = states[i];
            if (!s.started || s.done) {
                if (!s.done) allDone = false;
                continue;
            }

            allDone = false;

            // Advance progress
            s.progress += 0.02 * speed;

            if (s.progress >= 1) {
                s.progress = 1;
                s.done = true;
            }

            // Ink bleed: circle expanding with irregular edges simulated by polygon
            const p = s.progress;
            const radius = p * 75 * spread; // percentage

            // Create slightly irregular circle using ellipse with noise
            const rx = radius + Math.sin(p * 12 + i) * 3 * (1 - p);
            const ry = radius + Math.cos(p * 8 + i * 2) * 4 * (1 - p);

            // Use ellipse clip path for organic feel
            charSpans[i].style.clipPath = `ellipse(${rx}% ${ry}% at ${50 + Math.sin(p * 5) * 3 * (1 - p)}% ${50 + Math.cos(p * 7) * 2 * (1 - p)}%)`;

            // Blur fades out as ink settles
            const blur = Math.max(0, (1 - p) * 3);
            charSpans[i].style.filter = blur > 0.1 ? `blur(${blur}px)` : 'none';

            // Slight scale on initial impact
            const scale = p < 0.3 ? 1 + (0.3 - p) * 0.5 : 1;
            charSpans[i].style.transform = `scale(${scale})`;
        }

        if (allDone) {
            animationId = null;
            // Hold, then fade out and restart
            holdTimer = setTimeout(() => {
                if (destroyed) return;
                fadeOutAndRestart();
            }, holdDuration);
            return;
        }

        animationId = requestAnimationFrame(animate);
    }

    function fadeOutAndRestart() {
        if (destroyed) return;

        let fadeFrame = 0;
        function fadeOut() {
            if (destroyed) return;
            fadeFrame++;
            const opacity = Math.max(0, 1 - fadeFrame * 0.025);

            for (const span of charSpans) {
                span.style.opacity = String(opacity);
            }

            if (fadeFrame < 50) {
                animationId = requestAnimationFrame(fadeOut);
            } else {
                startCycle();
            }
        }

        animationId = requestAnimationFrame(fadeOut);
    }

    function startCycle() {
        if (destroyed) return;
        setup();

        // Stagger ink drops
        for (let i = 0; i < text.length; i++) {
            setTimeout(() => {
                if (destroyed) return;
                if (states[i]) states[i].started = true;
            }, i * staggerDelay);
        }

        animationId = requestAnimationFrame(animate);
    }

    function clearAll() {
        if (animationId !== null) { cancelAnimationFrame(animationId); animationId = null; }
        if (holdTimer !== null) { clearTimeout(holdTimer); holdTimer = null; }
    }

    return {
        play() {
            if (destroyed) return;
            clearAll();
            startCycle();
        },
        reset() {
            if (destroyed) return;
            clearAll();
            element.innerHTML = originalHTML;
            element.setAttribute('style', origStyle);
        },
        destroy() {
            destroyed = true;
            clearAll();
            element.innerHTML = originalHTML;
            element.setAttribute('style', origStyle);
        },
    };
}

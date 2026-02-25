import type { ChromaticTextConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

export function ChromaticText(config: ChromaticTextConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const speed = config.speed ?? 60;
    const intensity = config.intensity ?? 4;
    const blurAmount = config.blur ?? 0.5;
    const burstDuration = config.burstDuration ?? 600;
    const pauseDuration = config.pauseDuration ?? 1500;

    const originalHTML = element.innerHTML;
    const origPosition = element.style.position;
    const origOverflow = element.style.overflow;

    // Setup: position relative for absolute layers
    element.style.position = 'relative';
    element.style.overflow = 'visible';
    element.textContent = '';

    // Create three RGB channel layers
    function createLayer(color: string, zIndex: number): HTMLSpanElement {
        const span = document.createElement('span');
        span.textContent = text;
        span.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            color: ${color};
            mix-blend-mode: screen;
            transition: none;
            z-index: ${zIndex};
            white-space: nowrap;
            pointer-events: none;
        `;
        return span;
    }

    // Invisible base layer for sizing
    const baseLayer = document.createElement('span');
    baseLayer.textContent = text;
    baseLayer.style.cssText = 'visibility: hidden; white-space: nowrap;';
    element.appendChild(baseLayer);

    const redLayer = createLayer('#ff1040', 1);
    const greenLayer = createLayer('#40ff60', 2);
    const blueLayer = createLayer('#2060ff', 3);

    element.appendChild(redLayer);
    element.appendChild(greenLayer);
    element.appendChild(blueLayer);

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cycleTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function setNormal() {
        redLayer.style.transform = 'translate(0, 0)';
        greenLayer.style.transform = 'translate(0, 0)';
        blueLayer.style.transform = 'translate(0, 0)';
        redLayer.style.filter = 'none';
        greenLayer.style.filter = 'none';
        blueLayer.style.filter = 'none';
        redLayer.style.opacity = '0';
        greenLayer.style.opacity = '0';
        blueLayer.style.opacity = '0';
        // Show white text via base layer
        baseLayer.style.visibility = 'visible';
        baseLayer.style.color = 'inherit';
    }

    function glitchTick() {
        baseLayer.style.visibility = 'hidden';
        redLayer.style.opacity = '1';
        greenLayer.style.opacity = '1';
        blueLayer.style.opacity = '1';

        const spread = intensity * (0.5 + Math.random());
        const blurPx = blurAmount * (1 + Math.random() * 2);

        // Random chromatic offsets
        const rx = (-spread + Math.random() * spread * 0.5);
        const ry = (Math.random() - 0.5) * spread * 0.6;
        const bx = (spread - Math.random() * spread * 0.5);
        const by = (Math.random() - 0.5) * spread * 0.6;
        const gx = (Math.random() - 0.5) * spread * 0.2;
        const gy = (Math.random() - 0.5) * spread * 0.3;

        redLayer.style.transform = `translate(${rx}px, ${ry}px)`;
        greenLayer.style.transform = `translate(${gx}px, ${gy}px)`;
        blueLayer.style.transform = `translate(${bx}px, ${by}px)`;

        // Random blur on one or two channels
        const r = Math.random();
        if (r < 0.3) {
            redLayer.style.filter = `blur(${blurPx}px)`;
            greenLayer.style.filter = 'none';
            blueLayer.style.filter = 'none';
        } else if (r < 0.6) {
            redLayer.style.filter = 'none';
            greenLayer.style.filter = 'none';
            blueLayer.style.filter = `blur(${blurPx}px)`;
        } else {
            redLayer.style.filter = `blur(${blurPx * 0.5}px)`;
            greenLayer.style.filter = 'none';
            blueLayer.style.filter = `blur(${blurPx * 0.5}px)`;
        }

        // Occasional vertical slice displacement via clip-path
        if (Math.random() < 0.3) {
            const sliceY = Math.random() * 100;
            const sliceH = 5 + Math.random() * 15;
            const shift = (Math.random() - 0.5) * intensity * 3;
            redLayer.style.transform = `translate(${rx + shift}px, ${ry}px)`;
            // Clip a horizontal slice on one channel
            blueLayer.style.clipPath = `inset(${sliceY}% 0 ${100 - sliceY - sliceH}% 0)`;
        } else {
            blueLayer.style.clipPath = 'none';
        }

        // Occasional scale burst
        if (Math.random() < 0.15) {
            const scale = 1 + Math.random() * 0.08;
            greenLayer.style.transform = `translate(${gx}px, ${gy}px) scaleX(${scale})`;
        }
    }

    function cycle() {
        if (destroyed) return;

        // Glitch burst
        glitchTick();
        intervalId = setInterval(glitchTick, speed);

        cycleTimer = setTimeout(() => {
            if (destroyed) return;
            if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
            setNormal();
            blueLayer.style.clipPath = 'none';

            // Normal pause, then restart
            cycleTimer = setTimeout(() => cycle(), pauseDuration);
        }, burstDuration);
    }

    function clearAll() {
        if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
        if (cycleTimer !== null) { clearTimeout(cycleTimer); cycleTimer = null; }
    }

    function removeLayers() {
        redLayer.remove();
        greenLayer.remove();
        blueLayer.remove();
        baseLayer.remove();
        element.style.position = origPosition;
        element.style.overflow = origOverflow;
    }

    // Start in normal state
    setNormal();

    return {
        play() {
            if (destroyed) return;
            clearAll();
            cycle();
        },
        reset() {
            if (destroyed) return;
            clearAll();
            setNormal();
        },
        destroy() {
            destroyed = true;
            clearAll();
            removeLayers();
            element.innerHTML = originalHTML;
        },
    };
}

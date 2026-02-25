import type { EchoTrailConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

export function EchoTrail(config: EchoTrailConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const echoCount = config.echoes ?? 5;
    const speed = config.speed ?? 1;
    const spacing = config.spacing ?? 8;
    const color = config.color ?? '#00d4ff';
    const trailColor = config.trailColor ?? color;

    const originalHTML = element.innerHTML;
    const origStyle = element.getAttribute('style') || '';

    let animationId: number | null = null;
    let destroyed = false;
    let time = 0;

    // Container and layers
    let container: HTMLDivElement | null = null;
    const echoLayers: HTMLSpanElement[] = [];
    let mainLayer: HTMLSpanElement | null = null;

    function hexToRgb(hex: string): [number, number, number] {
        const h = hex.replace('#', '');
        return [
            parseInt(h.substring(0, 2), 16),
            parseInt(h.substring(2, 4), 16),
            parseInt(h.substring(4, 6), 16),
        ];
    }

    function setup() {
        element.innerHTML = '';
        element.style.display = 'inline-block';
        element.style.position = 'relative';
        element.style.overflow = 'visible';

        container = document.createElement('div');
        container.style.cssText = 'display: inline-block; position: relative;';

        echoLayers.length = 0;
        const [tr, tg, tb] = hexToRgb(trailColor);

        // Create echo layers (behind main)
        for (let i = echoCount - 1; i >= 0; i--) {
            const echo = document.createElement('span');
            echo.textContent = text;
            const opacity = 0.08 + (1 - i / echoCount) * 0.15;
            echo.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                white-space: nowrap;
                pointer-events: none;
                color: rgba(${tr},${tg},${tb},${opacity});
                filter: blur(${0.5 + i * 0.4}px);
                will-change: transform;
            `;
            container.appendChild(echo);
            echoLayers.push(echo);
        }

        // Main text layer on top
        mainLayer = document.createElement('span');
        mainLayer.textContent = text;
        mainLayer.style.cssText = `
            position: relative;
            white-space: nowrap;
            color: ${color};
            will-change: transform;
        `;
        container.appendChild(mainLayer);

        element.appendChild(container);
    }

    function animate() {
        if (destroyed) return;

        time += 0.016 * speed;

        // Main text moves in a smooth figure-8 / lissajous pattern
        const mainX = Math.sin(time * 1.2) * spacing * 3;
        const mainY = Math.sin(time * 2.1) * spacing * 0.8;

        if (mainLayer) {
            mainLayer.style.transform = `translate(${mainX}px, ${mainY}px)`;
        }

        // Each echo follows with increasing delay (trail effect)
        for (let i = 0; i < echoLayers.length; i++) {
            const delay = (i + 1) * 0.12;
            const t = time - delay;
            const ex = Math.sin(t * 1.2) * spacing * 3;
            const ey = Math.sin(t * 2.1) * spacing * 0.8;

            // Slight scale variation for depth
            const scale = 1 + (i + 1) * 0.008;
            echoLayers[i].style.transform = `translate(${ex}px, ${ey}px) scale(${scale})`;
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

import type { NeonPulseConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

export function NeonPulse(config: NeonPulseConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const color = config.color ?? '#00d4ff';
    const glowRadius = config.glowRadius ?? 20;
    const speed = config.speed ?? 1;
    const flicker = config.flicker ?? 0.4;
    const minBrightness = config.minBrightness ?? 0.3;

    const originalHTML = element.innerHTML;
    const origStyle = element.getAttribute('style') || '';

    let animationId: number | null = null;
    let destroyed = false;
    let time = 0;

    // Convert hex to rgb
    function hexToRgb(hex: string): [number, number, number] {
        const h = hex.replace('#', '');
        return [
            parseInt(h.substring(0, 2), 16),
            parseInt(h.substring(2, 4), 16),
            parseInt(h.substring(4, 6), 16),
        ];
    }

    const [r, g, b] = hexToRgb(color);

    function setup() {
        element.textContent = text;
        element.style.display = 'inline-block';
        element.style.color = color;
    }

    function applyGlow(brightness: number) {
        const br = Math.max(0, Math.min(1, brightness));
        const rad1 = Math.round(glowRadius * 0.3 * br);
        const rad2 = Math.round(glowRadius * 0.6 * br);
        const rad3 = Math.round(glowRadius * br);
        const rad4 = Math.round(glowRadius * 1.5 * br);

        element.style.textShadow = [
            `0 0 ${rad1}px rgba(${r},${g},${b},${br})`,
            `0 0 ${rad2}px rgba(${r},${g},${b},${br * 0.8})`,
            `0 0 ${rad3}px rgba(${r},${g},${b},${br * 0.5})`,
            `0 0 ${rad4}px rgba(${r},${g},${b},${br * 0.3})`,
        ].join(', ');

        element.style.opacity = String(minBrightness + (1 - minBrightness) * br);
    }

    function animate() {
        if (destroyed) return;

        time += 0.016 * speed;

        // Base sine pulse
        const pulse = 0.5 + 0.5 * Math.sin(time * 2.5);

        // Random flicker
        let flickerOffset = 0;
        if (flicker > 0) {
            // Occasional sharp flicker
            if (Math.random() < 0.04 * flicker) {
                flickerOffset = -(0.3 + Math.random() * 0.5) * flicker;
            }
            // Subtle noise
            flickerOffset += (Math.random() - 0.5) * 0.1 * flicker;
        }

        const brightness = Math.max(0, Math.min(1, pulse + flickerOffset));
        applyGlow(brightness);

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

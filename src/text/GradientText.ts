import type { GradientTextConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

export function GradientText(config: GradientTextConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const colors = config.colors ?? ['#f72585', '#7209b7', '#4361ee', '#4cc9f0', '#f72585'];
    const speed = config.speed ?? 1;
    const angle = config.angle ?? 90;

    const originalHTML = element.innerHTML;
    const origStyle = element.getAttribute('style') || '';

    let animationId: number | null = null;
    let destroyed = false;
    let offset = 0;

    // Build CSS gradient string — repeat colors for seamless loop
    const gradientColors = [...colors, ...colors].join(', ');

    function setup() {
        element.textContent = text;
        element.style.backgroundImage = `linear-gradient(${angle}deg, ${gradientColors})`;
        element.style.backgroundSize = '200% 200%';
        element.style.backgroundClip = 'text';
        element.style.webkitBackgroundClip = 'text';
        element.style.color = 'transparent';
        element.style.webkitTextFillColor = 'transparent';
        element.style.display = 'inline-block';
    }

    function animate() {
        if (destroyed) return;
        offset += 0.15 * speed;
        if (offset >= 100) offset -= 100;
        element.style.backgroundPosition = `${offset}% 50%`;
        animationId = requestAnimationFrame(animate);
    }

    return {
        play() {
            if (destroyed) return;
            if (animationId !== null) cancelAnimationFrame(animationId);
            setup();
            animate();
        },
        reset() {
            if (destroyed) return;
            if (animationId !== null) { cancelAnimationFrame(animationId); animationId = null; }
            element.innerHTML = originalHTML;
            element.setAttribute('style', origStyle);
        },
        destroy() {
            destroyed = true;
            if (animationId !== null) { cancelAnimationFrame(animationId); animationId = null; }
            element.innerHTML = originalHTML;
            element.setAttribute('style', origStyle);
        },
    };
}

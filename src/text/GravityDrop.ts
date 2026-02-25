import type { GravityDropConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

export function GravityDrop(config: GravityDropConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const gravity = config.gravity ?? 1;
    const bounceFactor = config.bounce ?? 0.5;
    const stagger = config.stagger ?? 80;
    const holdDuration = config.holdDuration ?? 1500;
    const color = config.color ?? '#ffffff';

    const originalHTML = element.innerHTML;
    const origStyle = element.getAttribute('style') || '';

    let animationId: number | null = null;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const charSpans: HTMLSpanElement[] = [];

    interface CharPhysics {
        y: number;
        vy: number;
        settled: boolean;
        started: boolean;
        rotation: number;
    }

    let physics: CharPhysics[] = [];

    function setup() {
        element.innerHTML = '';
        element.style.display = 'inline-block';
        element.style.whiteSpace = 'nowrap';
        element.style.overflow = 'visible';
        charSpans.length = 0;
        physics = [];

        for (let i = 0; i < text.length; i++) {
            const span = document.createElement('span');
            span.textContent = text[i] === ' ' ? '\u00A0' : text[i];
            span.style.display = 'inline-block';
            span.style.color = color;
            span.style.willChange = 'transform';
            span.style.opacity = '0';
            element.appendChild(span);
            charSpans.push(span);
            physics.push({
                y: -200 - Math.random() * 150,
                vy: 0,
                settled: false,
                started: false,
                rotation: (Math.random() - 0.5) * 60,
            });
        }
    }

    function animate() {
        if (destroyed) return;

        const g = 0.8 * gravity;
        const floor = 0;
        let allSettled = true;

        for (let i = 0; i < charSpans.length; i++) {
            const p = physics[i];
            if (!p.started) {
                allSettled = false;
                continue;
            }
            if (p.settled) continue;

            allSettled = false;

            // Apply gravity
            p.vy += g;
            p.y += p.vy;

            // Rotation decays toward 0
            p.rotation *= 0.95;

            // Bounce off floor
            if (p.y >= floor) {
                p.y = floor;
                p.vy = -Math.abs(p.vy) * bounceFactor;
                p.rotation *= 0.5;

                // Settle when velocity is tiny
                if (Math.abs(p.vy) < 1.5) {
                    p.y = floor;
                    p.vy = 0;
                    p.rotation = 0;
                    p.settled = true;
                }
            }

            charSpans[i].style.transform = `translateY(${p.y}px) rotate(${p.rotation}deg)`;
            charSpans[i].style.opacity = '1';
        }

        if (allSettled && physics.every((p) => p.started)) {
            // All landed — hold, then reverse gravity and restart
            animationId = null;
            holdTimer = setTimeout(() => {
                if (destroyed) return;
                reverseAndRestart();
            }, holdDuration);
            return;
        }

        animationId = requestAnimationFrame(animate);
    }

    function reverseAndRestart() {
        if (destroyed) return;

        let frame = 0;
        function floatUp() {
            if (destroyed) return;
            frame++;

            for (let i = 0; i < charSpans.length; i++) {
                const p = physics[i];
                p.vy -= 0.3 * gravity;
                p.y += p.vy;
                p.rotation += (Math.random() - 0.5) * 2;
                const opacity = Math.max(0, 1 - frame * 0.015);
                charSpans[i].style.transform = `translateY(${p.y}px) rotate(${p.rotation}deg)`;
                charSpans[i].style.opacity = String(opacity);
            }

            if (frame < 80) {
                animationId = requestAnimationFrame(floatUp);
            } else {
                // Restart cycle
                startCycle();
            }
        }

        // Give each char a small upward kick
        for (const p of physics) {
            p.vy = -(2 + Math.random() * 3);
            p.settled = false;
        }

        animationId = requestAnimationFrame(floatUp);
    }

    function startCycle() {
        if (destroyed) return;
        setup();

        // Stagger the drop start
        for (let i = 0; i < text.length; i++) {
            setTimeout(() => {
                if (destroyed) return;
                if (physics[i]) {
                    physics[i].started = true;
                    charSpans[i].style.opacity = '1';
                }
            }, i * stagger);
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

import type { MagneticAssembleConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

export function MagneticAssemble(config: MagneticAssembleConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const force = config.force ?? 1;
    const scatterRadius = config.scatterRadius ?? 300;
    const holdDuration = config.holdDuration ?? 1500;
    const color = config.color ?? '#ffffff';
    const damping = config.damping ?? 0.15;

    const originalHTML = element.innerHTML;
    const origStyle = element.getAttribute('style') || '';

    let animationId: number | null = null;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const charSpans: HTMLSpanElement[] = [];

    interface CharPhysics {
        x: number;
        y: number;
        vx: number;
        vy: number;
        rotation: number;
        vr: number;
        settled: boolean;
        settleFrames: number;
        delayFrames: number;
    }

    let physics: CharPhysics[] = [];

    function setup() {
        element.innerHTML = '';
        element.style.display = 'inline-block';
        element.style.whiteSpace = 'nowrap';
        element.style.overflow = 'visible';
        element.style.position = 'relative';
        charSpans.length = 0;
        physics = [];

        for (let i = 0; i < text.length; i++) {
            const span = document.createElement('span');
            span.textContent = text[i] === ' ' ? '\u00A0' : text[i];
            span.style.display = 'inline-block';
            span.style.color = color;
            span.style.willChange = 'transform';

            // Start at random scattered positions — vary distance per char for natural stagger
            const angle = Math.random() * Math.PI * 2;
            const dist = scatterRadius * (0.3 + Math.random() * 0.7);
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            const rotation = (Math.random() - 0.5) * 360;

            span.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
            span.style.opacity = '0';

            element.appendChild(span);
            charSpans.push(span);
            physics.push({
                x, y,
                vx: 0, vy: 0,
                rotation,
                vr: (Math.random() - 0.5) * 5,
                settled: false,
                settleFrames: 0,
                delayFrames: Math.floor(Math.random() * 40),
            });
        }

        // Fade in quickly
        requestAnimationFrame(() => {
            for (const span of charSpans) {
                span.style.transition = 'opacity 0.3s';
                span.style.opacity = '1';
            }
        });
    }

    function animate() {
        if (destroyed) return;

        const pullStrength = 0.06 * force;
        let allSettled = true;

        for (let i = 0; i < charSpans.length; i++) {
            const p = physics[i];
            if (p.settled) continue;

            allSettled = false;

            // Per-character random delay before pull starts
            if (p.delayFrames > 0) {
                p.delayFrames--;
                charSpans[i].style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`;
                continue;
            }

            // Magnetic pull toward origin (0, 0)
            const dx = -p.x;
            const dy = -p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Spring force: pulls harder when farther
            const fx = dx * pullStrength;
            const fy = dy * pullStrength;

            p.vx += fx;
            p.vy += fy;

            // Damping
            p.vx *= (1 - damping);
            p.vy *= (1 - damping);

            p.x += p.vx;
            p.y += p.vy;

            // Rotation spring toward 0
            p.vr *= 0.9;
            p.vr += -p.rotation * 0.08;
            p.rotation += p.vr;

            // Check if settled
            if (dist < 1 && Math.abs(p.vx) < 0.3 && Math.abs(p.vy) < 0.3 && Math.abs(p.rotation) < 2) {
                p.settleFrames++;
                if (p.settleFrames > 10) {
                    p.x = 0;
                    p.y = 0;
                    p.rotation = 0;
                    p.settled = true;
                }
            } else {
                p.settleFrames = 0;
            }

            charSpans[i].style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`;
        }

        if (allSettled) {
            // Flash effect on assembly
            for (const span of charSpans) {
                span.style.textShadow = `0 0 12px ${color}, 0 0 24px ${color}`;
            }
            setTimeout(() => {
                if (destroyed) return;
                for (const span of charSpans) {
                    span.style.transition = 'text-shadow 0.5s';
                    span.style.textShadow = 'none';
                }
            }, 100);

            animationId = null;
            holdTimer = setTimeout(() => {
                if (destroyed) return;
                explodeAndRestart();
            }, holdDuration);
            return;
        }

        animationId = requestAnimationFrame(animate);
    }

    function explodeAndRestart() {
        if (destroyed) return;

        // Explode outward
        for (const p of physics) {
            const angle = Math.random() * Math.PI * 2;
            const power = 8 + Math.random() * 12;
            p.vx = Math.cos(angle) * power;
            p.vy = Math.sin(angle) * power;
            p.vr = (Math.random() - 0.5) * 20;
            p.settled = false;
            p.settleFrames = 0;
        }

        let frame = 0;
        function scatter() {
            if (destroyed) return;
            frame++;

            for (let i = 0; i < charSpans.length; i++) {
                const p = physics[i];
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.vr;
                p.vx *= 0.98;
                p.vy *= 0.98;

                const opacity = Math.max(0, 1 - frame * 0.03);
                charSpans[i].style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`;
                charSpans[i].style.opacity = String(opacity);
                charSpans[i].style.transition = 'none';
            }

            if (frame < 40) {
                animationId = requestAnimationFrame(scatter);
            } else {
                startCycle();
            }
        }

        animationId = requestAnimationFrame(scatter);
    }

    function startCycle() {
        if (destroyed) return;
        setup();
        // Small delay for fade-in to complete
        setTimeout(() => {
            if (destroyed) return;
            animationId = requestAnimationFrame(animate);
        }, 350);
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

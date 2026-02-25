import type { MagneticSandConfig, BackgroundInstance } from '../types';
import { resolveContainer, createCanvas } from '../createBackground';

function hexToRgb(hex: string): [number, number, number] {
    const c = hex.replace('#', '');
    return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
}

interface Particle {
    x: number;
    y: number;
    homeX: number;
    homeY: number;
    vx: number;
    vy: number;
    angle: number;
}

export function MagneticSand(config: MagneticSandConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;
    const canvas = createCanvas(container, width, height);
    const ctx = canvas.getContext('2d')!;

    const count = config.particleCount ?? 5000;
    const baseColor = hexToRgb(config.color ?? '#5a828c');
    const fieldColor = hexToRgb(config.fieldColor ?? '#e1ff00');
    const bgColor = config.bgColor ?? '#050508';
    const forceMul = config.force ?? 1;
    const mouseRadius = config.mouseRadius ?? 200;
    const speedMul = config.speed ?? 1;
    const pSize = config.particleSize ?? 1;
    const fieldStrength = config.fieldStrength ?? 0.5;

    let animationId: number | null = null;
    let mouseX = -1000;
    let mouseY = -1000;

    // Init particles with home positions
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        particles.push({
            x, y,
            homeX: x,
            homeY: y,
            vx: 0,
            vy: 0,
            angle: Math.random() * Math.PI * 2,
        });
    }

    const damping = 0.94;
    const returnForce = 0.008; // how fast particles return home

    function draw() {
        const w = canvas.width;
        const h = canvas.height;

        // Semi-transparent clear for trails
        ctx.fillStyle = bgColor;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;

        // Mouse in canvas coords
        const rect = canvas.getBoundingClientRect();
        const mx = mouseX - rect.left;
        const my = mouseY - rect.top;
        const mouseActive = mx >= 0 && mx <= w && my >= 0 && my <= h;

        for (let i = 0; i < count; i++) {
            const p = particles[i];

            if (mouseActive) {
                const dx = p.x - mx;
                const dy = p.y - my;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < mouseRadius && dist > 1) {
                    // Explosion: push away from mouse
                    const influence = (1 - dist / mouseRadius);
                    const explosionForce = influence * influence * forceMul * 3;
                    p.vx += (dx / dist) * explosionForce;
                    p.vy += (dy / dist) * explosionForce;
                }
            }

            // Spring back to home position
            const homeX = p.homeX - p.x;
            const homeY = p.homeY - p.y;
            p.vx += homeX * returnForce;
            p.vy += homeY * returnForce;

            // Damping
            p.vx *= damping;
            p.vy *= damping;

            // Move
            p.x += p.vx * speedMul;
            p.y += p.vy * speedMul;

            // Update angle from velocity
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed > 0.3) {
                p.angle = Math.atan2(p.vy, p.vx);
            }

            // Draw particle as small line (oriented by angle)
            const len = (1 + speed * 2) * pSize;
            const cosA = Math.cos(p.angle);
            const sinA = Math.sin(p.angle);

            // Color: blend towards field color when near mouse and aligned
            let r = baseColor[0], g = baseColor[1], b = baseColor[2];
            let alpha = 0.4;

            if (mouseActive) {
                const dx = mx - p.x;
                const dy = my - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < mouseRadius) {
                    const inf = 1 - dist / mouseRadius;
                    r += (fieldColor[0] - baseColor[0]) * inf * fieldStrength;
                    g += (fieldColor[1] - baseColor[1]) * inf * fieldStrength;
                    b += (fieldColor[2] - baseColor[2]) * inf * fieldStrength;
                    alpha = 0.4 + inf * 0.5;
                }
            }

            ctx.beginPath();
            ctx.moveTo(p.x - cosA * len, p.y - sinA * len);
            ctx.lineTo(p.x + cosA * len, p.y + sinA * len);
            ctx.strokeStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
            ctx.lineWidth = 0.8 * pSize;
            ctx.stroke();
        }

        animationId = requestAnimationFrame(draw);
    }

    function onMouseMove(e: MouseEvent) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }

    function onMouseLeave() {
        mouseX = -1000;
        mouseY = -1000;
    }

    function handleResize() {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        // Full clear on resize
        ctx.fillStyle = bgColor;
        ctx.globalAlpha = 1;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);
    if (config.responsive !== false) {
        window.addEventListener('resize', handleResize);
    }

    return {
        start() {
            if (!animationId) {
                // Full clear on start
                ctx.fillStyle = bgColor;
                ctx.globalAlpha = 1;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                draw();
            }
        },
        stop() {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        },
        destroy() {
            this.stop();
            window.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mouseleave', onMouseLeave);
            window.removeEventListener('resize', handleResize);
            canvas.remove();
        },
        resize(w: number, h: number) {
            canvas.width = w;
            canvas.height = h;
        },
    };
}

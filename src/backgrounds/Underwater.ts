import type { UnderwaterConfig, BackgroundInstance } from '../types';
import { resolveContainer, createCanvas } from '../createBackground';

interface Bubble {
    x: number;
    y: number;
    r: number;
    speed: number;
    wobbleOffset: number;
    wobbleSpeed: number;
    opacity: number;
}

interface Fish {
    x: number;
    y: number;
    size: number;
    speed: number;
    dir: 1 | -1;
    depth: number;          // 0-1, affects color tint
    tailPhase: number;
    color: string;
    wobbleOffset: number;
}

interface Seaweed {
    x: number;
    segments: number;
    height: number;
    phase: number;
    hue: number;
}

interface Particle {
    x: number;
    y: number;
    size: number;
    speed: number;
    drift: number;
    opacity: number;
}

const FISH_PALETTE = ['#ff6b35', '#f7c948', '#e84393', '#00b894', '#74b9ff', '#fd79a8', '#e17055', '#55efc4'];

function hexToRgb(hex: string): [number, number, number] {
    const v = parseInt(hex.replace('#', ''), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function Underwater(config: UnderwaterConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;
    const canvas = createCanvas(container, width, height);
    const ctx = canvas.getContext('2d')!;

    const deepColor = config.deepColor ?? '#041430';
    const shallowColor = config.shallowColor ?? '#0a3d6b';
    const lightColor = config.lightColor ?? '#1a8fff';
    const bubbleColor = config.bubbleColor ?? '#88ccff';
    const fishCount = config.fishCount ?? 8;
    const bubbleCount = config.bubbleCount ?? 30;
    const speedMul = config.speed ?? 1;
    const lightIntensity = config.lightIntensity ?? 0.4;
    const seaweedCount = config.seaweedCount ?? 12;

    let animationId: number | null = null;
    let time = 0;
    let mouseX = -1000;
    let mouseY = -1000;

    // --- Init entities ---

    function makeBubble(w: number, h: number): Bubble {
        return {
            x: Math.random() * w,
            y: h + Math.random() * h * 0.3,
            r: 1.5 + Math.random() * 4.5,
            speed: 0.3 + Math.random() * 0.7,
            wobbleOffset: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.5 + Math.random() * 1.5,
            opacity: 0.15 + Math.random() * 0.35,
        };
    }

    function makeFish(w: number, h: number): Fish {
        const dir = (Math.random() < 0.5 ? 1 : -1) as 1 | -1;
        return {
            x: dir === 1 ? -40 - Math.random() * w * 0.5 : w + 40 + Math.random() * w * 0.5,
            y: h * 0.15 + Math.random() * h * 0.65,
            size: 10 + Math.random() * 18,
            speed: 0.4 + Math.random() * 0.8,
            dir,
            depth: 0.2 + Math.random() * 0.8,
            tailPhase: Math.random() * Math.PI * 2,
            color: FISH_PALETTE[Math.floor(Math.random() * FISH_PALETTE.length)],
            wobbleOffset: Math.random() * Math.PI * 2,
        };
    }

    function makeSeaweed(w: number): Seaweed {
        return {
            x: Math.random() * w,
            segments: 6 + Math.floor(Math.random() * 5),
            height: 60 + Math.random() * 100,
            phase: Math.random() * Math.PI * 2,
            hue: 100 + Math.random() * 60,
        };
    }

    function makeParticle(w: number, h: number): Particle {
        return {
            x: Math.random() * w,
            y: Math.random() * h,
            size: 0.5 + Math.random() * 1.5,
            speed: 0.1 + Math.random() * 0.3,
            drift: (Math.random() - 0.5) * 0.3,
            opacity: 0.1 + Math.random() * 0.3,
        };
    }

    let bubbles: Bubble[] = [];
    let fishes: Fish[] = [];
    let seaweeds: Seaweed[] = [];
    let particles: Particle[] = [];

    function initEntities() {
        const w = canvas.width;
        const h = canvas.height;
        bubbles = Array.from({ length: bubbleCount }, () => makeBubble(w, h));
        // Spread initial bubbles across screen
        for (const b of bubbles) b.y = Math.random() * h;
        fishes = Array.from({ length: fishCount }, () => makeFish(w, h));
        // Spread initial fish across screen
        for (const f of fishes) f.x = Math.random() * w;
        seaweeds = Array.from({ length: seaweedCount }, () => makeSeaweed(w));
        particles = Array.from({ length: 50 }, () => makeParticle(w, h));
    }
    initEntities();

    // --- Drawing functions ---

    function drawBackground(w: number, h: number) {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, shallowColor);
        grad.addColorStop(1, deepColor);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    function drawLightRays(w: number, h: number) {
        const [lr, lg, lb] = hexToRgb(lightColor);
        const rayCount = 5;
        for (let i = 0; i < rayCount; i++) {
            const baseX = (w / (rayCount + 1)) * (i + 1);
            const sway = Math.sin(time * 0.3 * speedMul + i * 1.8) * 40;
            const topX = baseX + sway;
            const spread = 30 + Math.sin(time * 0.2 * speedMul + i * 2.5) * 15;
            const alpha = lightIntensity * (0.06 + Math.sin(time * 0.5 * speedMul + i * 1.2) * 0.02);

            ctx.beginPath();
            ctx.moveTo(topX - spread * 0.3, 0);
            ctx.lineTo(topX + spread * 0.3, 0);
            ctx.lineTo(topX + spread * 2.5 + sway * 0.5, h);
            ctx.lineTo(topX - spread * 2.5 + sway * 0.5, h);
            ctx.closePath();

            const rayGrad = ctx.createLinearGradient(0, 0, 0, h);
            rayGrad.addColorStop(0, `rgba(${lr}, ${lg}, ${lb}, ${alpha})`);
            rayGrad.addColorStop(0.6, `rgba(${lr}, ${lg}, ${lb}, ${alpha * 0.3})`);
            rayGrad.addColorStop(1, `rgba(${lr}, ${lg}, ${lb}, 0)`);
            ctx.fillStyle = rayGrad;
            ctx.fill();
        }
    }

    function drawSeaweed(h: number) {
        for (const sw of seaweeds) {
            const segH = sw.height / sw.segments;
            ctx.beginPath();
            ctx.moveTo(sw.x, h);

            let cx = sw.x;
            for (let s = 0; s < sw.segments; s++) {
                const t = s / sw.segments;
                const sway = Math.sin(time * 0.8 * speedMul + sw.phase + s * 0.6) * (12 + t * 20);
                cx = sw.x + sway * t;
                const cy = h - segH * (s + 1);
                ctx.lineTo(cx, cy);
            }

            // Draw back to create thickness
            for (let s = sw.segments - 1; s >= 0; s--) {
                const t = s / sw.segments;
                const sway = Math.sin(time * 0.8 * speedMul + sw.phase + s * 0.6 + 0.3) * (12 + t * 20);
                cx = sw.x + sway * t + 4 + (1 - t) * 4;
                const cy = h - segH * (s + 1);
                ctx.lineTo(cx, cy);
            }

            ctx.lineTo(sw.x + 8, h);
            ctx.closePath();

            ctx.fillStyle = `hsla(${sw.hue}, 60%, 25%, 0.7)`;
            ctx.fill();
        }
    }

    function drawBubble(b: Bubble) {
        const [br, bg, bb] = hexToRgb(bubbleColor);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${br}, ${bg}, ${bb}, ${b.opacity})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Highlight
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.6})`;
        ctx.fill();
    }

    function drawFish(f: Fish) {
        const [fr, fg, fb] = hexToRgb(f.color);
        const depthAlpha = 0.4 + f.depth * 0.6;
        const bodyLen = f.size;
        const bodyH = f.size * 0.45;
        const tailSwing = Math.sin(time * 4 * speedMul + f.tailPhase) * bodyH * 0.6;

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(f.dir, 1);

        // Body (ellipse)
        ctx.beginPath();
        ctx.ellipse(0, 0, bodyLen, bodyH, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${fr}, ${fg}, ${fb}, ${depthAlpha})`;
        ctx.fill();

        // Tail
        ctx.beginPath();
        ctx.moveTo(-bodyLen, 0);
        ctx.lineTo(-bodyLen - bodyLen * 0.5, -bodyH * 0.7 + tailSwing);
        ctx.lineTo(-bodyLen - bodyLen * 0.5, bodyH * 0.7 + tailSwing);
        ctx.closePath();
        ctx.fillStyle = `rgba(${fr}, ${fg}, ${fb}, ${depthAlpha * 0.85})`;
        ctx.fill();

        // Eye
        ctx.beginPath();
        ctx.arc(bodyLen * 0.5, -bodyH * 0.2, bodyH * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${depthAlpha * 0.9})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bodyLen * 0.55, -bodyH * 0.2, bodyH * 0.09, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${depthAlpha * 0.9})`;
        ctx.fill();

        // Dorsal fin
        ctx.beginPath();
        ctx.moveTo(bodyLen * 0.1, -bodyH);
        ctx.quadraticCurveTo(bodyLen * -0.1, -bodyH - bodyH * 0.5, -bodyLen * 0.3, -bodyH * 0.6);
        ctx.lineTo(0, -bodyH * 0.5);
        ctx.closePath();
        ctx.fillStyle = `rgba(${fr}, ${fg}, ${fb}, ${depthAlpha * 0.6})`;
        ctx.fill();

        ctx.restore();
    }

    function drawParticles() {
        for (const p of particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(180, 220, 255, ${p.opacity})`;
            ctx.fill();
        }
    }

    // --- Update logic ---

    function updateBubbles(w: number, h: number) {
        for (const b of bubbles) {
            b.y -= b.speed * speedMul;
            b.x += Math.sin(time * b.wobbleSpeed + b.wobbleOffset) * 0.3;
            if (b.y < -10) {
                b.y = h + 10;
                b.x = Math.random() * w;
            }
        }
    }

    function updateFish(w: number, h: number) {
        for (const f of fishes) {
            f.x += f.speed * f.dir * speedMul;
            f.y += Math.sin(time * 0.6 * speedMul + f.wobbleOffset) * 0.3;

            // Mouse avoidance
            const dx = f.x - mouseX;
            const dy = f.y - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                const force = (1 - dist / 120) * 2;
                f.x += (dx / dist) * force;
                f.y += (dy / dist) * force;
            }

            // Reset when off screen
            if (f.dir === 1 && f.x > w + 60) {
                Object.assign(f, makeFish(w, h));
                f.dir = 1;
                f.x = -40 - Math.random() * 60;
            } else if (f.dir === -1 && f.x < -60) {
                Object.assign(f, makeFish(w, h));
                f.dir = -1;
                f.x = w + 40 + Math.random() * 60;
            }
        }
    }

    function updateParticles(w: number, h: number) {
        for (const p of particles) {
            p.y -= p.speed * speedMul;
            p.x += p.drift * speedMul;
            if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
            if (p.x < -5 || p.x > w + 5) { p.x = Math.random() * w; }
        }
    }

    // --- Main loop ---

    function animate() {
        animationId = requestAnimationFrame(animate);
        const w = canvas.width;
        const h = canvas.height;

        drawBackground(w, h);
        drawLightRays(w, h);
        drawSeaweed(h);

        // Sort fish by depth for painter's algo
        fishes.sort((a, b) => a.depth - b.depth);
        for (const f of fishes) drawFish(f);

        for (const b of bubbles) drawBubble(b);
        drawParticles();

        // Water surface caustic overlay
        ctx.fillStyle = `rgba(0, 80, 160, ${0.03 + Math.sin(time * 0.4) * 0.01})`;
        ctx.fillRect(0, 0, w, h);

        updateBubbles(w, h);
        updateFish(w, h);
        updateParticles(w, h);

        time += 0.016;
    }

    // --- Event handlers ---

    function handleMouseMove(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    }

    function handleMouseLeave() {
        mouseX = -1000;
        mouseY = -1000;
    }

    function handleResize() {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        initEntities();
    }

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.style.pointerEvents = 'auto';

    if (config.responsive !== false) {
        window.addEventListener('resize', handleResize);
    }

    return {
        start() { if (!animationId) animate(); },
        stop() { if (animationId) { cancelAnimationFrame(animationId); animationId = null; } },
        destroy() {
            this.stop();
            window.removeEventListener('resize', handleResize);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            canvas.remove();
        },
        resize(w: number, h: number) {
            canvas.width = w;
            canvas.height = h;
            initEntities();
        },
    };
}

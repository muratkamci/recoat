import type { GlitchFogConfig, BackgroundInstance } from '../types';
import { resolveContainer, createCanvas } from '../createBackground';

// Simple hash noise
function hash(x: number, y: number, seed: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 113.5) * 43758.5453;
    return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = hash(ix, iy, seed);
    const n10 = hash(ix + 1, iy, seed);
    const n01 = hash(ix, iy + 1, seed);
    const n11 = hash(ix + 1, iy + 1, seed);
    return (n00 + (n10 - n00) * sx) + ((n01 + (n11 - n01) * sx) - (n00 + (n10 - n00) * sx)) * sy;
}

function fbm(x: number, y: number, seed: number, octaves: number = 5): number {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < octaves; i++) {
        val += smoothNoise(x * freq, y * freq, seed + i * 17) * amp;
        amp *= 0.5;
        freq *= 2;
    }
    return val;
}

function hexToRgb(hex: string): [number, number, number] {
    const c = hex.replace('#', '');
    return [
        parseInt(c.substring(0, 2), 16),
        parseInt(c.substring(2, 4), 16),
        parseInt(c.substring(4, 6), 16),
    ];
}

export function GlitchFog(config: GlitchFogConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;
    const canvas = createCanvas(container, width, height);
    const ctx = canvas.getContext('2d')!;

    const color1 = hexToRgb(config.color ?? '#de0d87');
    const color2 = hexToRgb(config.colorSecondary ?? '#cc5c00');
    const glitchColor = hexToRgb(config.glitchColor ?? '#ff6020');
    const bgColor = config.bgColor ?? '#050510';
    const speedMul = config.speed ?? 2.7;
    const density = config.density ?? 0.8;
    const glitchFreq = config.glitchFrequency ?? 0.41;
    const glitchIntensity = config.glitchIntensity ?? 0.7;
    let animationId: number | null = null;
    let time = 0;
    let glitchActive = false;
    let glitchTimer = 0;
    let glitchSlices: { y: number; h: number; offset: number }[] = [];

    // Offscreen buffer for RGB split
    let offCanvas: HTMLCanvasElement | null = null;
    let offCtx: CanvasRenderingContext2D | null = null;

    function ensureOffscreen(w: number, h: number) {
        if (!offCanvas || offCanvas.width !== w || offCanvas.height !== h) {
            offCanvas = document.createElement('canvas');
            offCanvas.width = w;
            offCanvas.height = h;
            offCtx = offCanvas.getContext('2d')!;
        }
    }

    function triggerGlitch() {
        glitchActive = true;
        glitchTimer = 6 + Math.random() * 10; // frames

        // Random horizontal slices
        const sliceCount = 4 + Math.floor(Math.random() * 8);
        glitchSlices = [];
        const h = canvas.height;
        for (let i = 0; i < sliceCount; i++) {
            glitchSlices.push({
                y: Math.random() * h,
                h: 4 + Math.random() * 40,
                offset: (Math.random() - 0.5) * 80 * glitchIntensity,
            });
        }
    }

    function drawFog(targetCtx: CanvasRenderingContext2D) {
        const w = canvas.width;
        const h = canvas.height;
        const t = time * 0.008 * speedMul;

        // Background
        targetCtx.fillStyle = bgColor;
        targetCtx.fillRect(0, 0, w, h);

        // Render fog in horizontal strips for performance
        const stripH = 4;
        const stripW = 4;

        for (let y = 0; y < h; y += stripH) {
            for (let x = 0; x < w; x += stripW) {
                const nx = x / w;
                const ny = y / h;

                // Layered fog noise
                const n1 = fbm(nx * 3 + t * 0.4, ny * 2 + t * 0.2, 0, 4);
                const n2 = fbm(nx * 2 - t * 0.3, ny * 3 + t * 0.15, 50, 3);
                const n3 = fbm(nx * 4 + t * 0.1, ny * 1.5 - t * 0.25, 100, 3);

                // Combine layers
                const fogVal = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2) * density;

                // Color mixing based on position and noise
                const colorMix = n2;
                const r = color1[0] + (color2[0] - color1[0]) * colorMix;
                const g = color1[1] + (color2[1] - color1[1]) * colorMix;
                const b = color1[2] + (color2[2] - color1[2]) * colorMix;

                const alpha = Math.max(0, Math.min(1, fogVal));
                if (alpha < 0.01) continue;

                targetCtx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
                targetCtx.fillRect(x, y, stripW, stripH);
            }
        }

    }

    function draw() {
        const w = canvas.width;
        const h = canvas.height;

        // Decide if glitch triggers this frame
        if (!glitchActive && Math.random() < glitchFreq * 0.08) {
            triggerGlitch();
        }

        // Always draw fog to offscreen, then composite to main canvas
        ensureOffscreen(w, h);
        drawFog(offCtx!);

        // Draw base to main canvas
        ctx.drawImage(offCanvas!, 0, 0);

        if (glitchActive) {
            // RGB channel split via pixel manipulation
            const splitAmount = Math.round((4 + Math.random() * 8) * glitchIntensity);
            const imageData = ctx.getImageData(0, 0, w, h);
            const src = new Uint8ClampedArray(imageData.data);
            const dst = imageData.data;

            for (let i = 0; i < h; i++) {
                for (let j = 0; j < w; j++) {
                    const idx = (i * w + j) * 4;

                    // Red channel shifted right
                    const rSrc = j - splitAmount;
                    if (rSrc >= 0 && rSrc < w) {
                        dst[idx] = src[(i * w + rSrc) * 4];
                    }

                    // Blue channel shifted left
                    const bSrc = j + splitAmount;
                    if (bSrc >= 0 && bSrc < w) {
                        dst[idx + 2] = src[(i * w + bSrc) * 4 + 2];
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0);

            // Horizontal slice displacement
            for (const slice of glitchSlices) {
                const sliceData = ctx.getImageData(0, slice.y | 0, w, slice.h | 0);
                ctx.putImageData(sliceData, slice.offset | 0, slice.y | 0);
            }

            // Subtle glitch color tint
            ctx.fillStyle = `rgba(${glitchColor[0]}, ${glitchColor[1]}, ${glitchColor[2]}, ${0.04 * glitchIntensity})`;
            ctx.fillRect(0, 0, w, h);

            glitchTimer--;
            if (glitchTimer <= 0) {
                glitchActive = false;
            }
        }

        time += 1;
        animationId = requestAnimationFrame(draw);
    }

    function handleResize() {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }

    if (config.responsive !== false) {
        window.addEventListener('resize', handleResize);
    }

    return {
        start() {
            if (!animationId) draw();
        },
        stop() {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        },
        destroy() {
            this.stop();
            window.removeEventListener('resize', handleResize);
            offCanvas = null;
            offCtx = null;
            canvas.remove();
        },
        resize(w: number, h: number) {
            canvas.width = w;
            canvas.height = h;
        },
    };
}

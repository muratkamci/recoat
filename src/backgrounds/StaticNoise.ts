import type { StaticNoiseConfig, BackgroundInstance } from '../types';
import { resolveContainer, createCanvas } from '../createBackground';

function hexToRgb(hex: string): [number, number, number] {
    const c = hex.replace('#', '');
    return [
        parseInt(c.substring(0, 2), 16),
        parseInt(c.substring(2, 4), 16),
        parseInt(c.substring(4, 6), 16),
    ];
}

export function StaticNoise(config: StaticNoiseConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;
    const canvas = createCanvas(container, width, height);
    const ctx = canvas.getContext('2d')!;

    const brightness = config.brightness ?? 0.5;
    const contrast = config.contrast ?? 0.8;
    const tint = config.tint ? hexToRgb(config.tint) : null;
    const scanlineIntensity = config.scanlines ?? 0.75;
    const syncGlitch = config.syncGlitch ?? 0.18;
    const pixelSize = config.pixelSize ?? 2;
    const vignetteAmount = config.vignette ?? 0.85;
    const flickerAmount = config.flicker ?? 0.1;

    let animationId: number | null = null;

    // Offscreen noise canvas (small, scaled up for chunky pixels)
    let noiseCanvas: HTMLCanvasElement | null = null;
    let noiseCtx: CanvasRenderingContext2D | null = null;
    let noiseW = 0;
    let noiseH = 0;
    let imageData: ImageData | null = null;

    function ensureNoise(w: number, h: number) {
        const nw = Math.ceil(w / pixelSize);
        const nh = Math.ceil(h / pixelSize);
        if (nw !== noiseW || nh !== noiseH) {
            noiseW = nw;
            noiseH = nh;
            noiseCanvas = document.createElement('canvas');
            noiseCanvas.width = nw;
            noiseCanvas.height = nh;
            noiseCtx = noiseCanvas.getContext('2d')!;
            imageData = noiseCtx.createImageData(nw, nh);
        }
    }

    function draw() {
        const w = canvas.width;
        const h = canvas.height;

        ensureNoise(w, h);
        const data = imageData!.data;

        // Global flicker
        const flicker = 1 - (Math.random() * flickerAmount);

        // Horizontal sync glitch
        const hasSync = Math.random() < syncGlitch;
        const syncY = hasSync ? Math.floor(Math.random() * noiseH) : -1;
        const syncH = hasSync ? 2 + Math.floor(Math.random() * 8) : 0;
        const syncOffset = hasSync ? Math.floor((Math.random() - 0.5) * noiseW * 0.3) : 0;

        // Vignette
        const cx = noiseW / 2;
        const cy = noiseH / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy);

        for (let y = 0; y < noiseH; y++) {
            // Sync glitch: shift this row?
            const rowShift = (hasSync && y >= syncY && y < syncY + syncH) ? syncOffset : 0;

            for (let x = 0; x < noiseW; x++) {
                const srcX = ((x + rowShift) % noiseW + noiseW) % noiseW;
                const idx = (y * noiseW + srcX) * 4;

                // Random noise
                let val = Math.random();

                // Contrast
                val = (val - 0.5) * (1 + contrast * 3) + 0.5;
                val = Math.max(0, Math.min(1, val));

                // Brightness + flicker
                val *= brightness * 2 * flicker;

                // Scanlines (every other row darker)
                if (scanlineIntensity > 0 && y % 2 === 0) {
                    val *= (1 - scanlineIntensity * 0.5);
                }

                // Vignette
                if (vignetteAmount > 0) {
                    const dx = x - cx;
                    const dy = y - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
                    val *= Math.max(0, 1 - dist * vignetteAmount);
                }

                val = Math.max(0, Math.min(1, val)) * 255;

                if (tint) {
                    const t = val / 255;
                    data[idx] = t * tint[0];
                    data[idx + 1] = t * tint[1];
                    data[idx + 2] = t * tint[2];
                } else {
                    data[idx] = val;
                    data[idx + 1] = val;
                    data[idx + 2] = val;
                }
                data[idx + 3] = 255;
            }
        }

        // Put noise into small canvas, then scale up
        noiseCtx!.putImageData(imageData!, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(noiseCanvas!, 0, 0, w, h);

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
            noiseCanvas = null;
            noiseCtx = null;
            imageData = null;
            canvas.remove();
        },
        resize(w: number, h: number) {
            canvas.width = w;
            canvas.height = h;
        },
    };
}

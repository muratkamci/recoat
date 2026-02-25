import type { AsciiGridConfig, BackgroundInstance } from '../types';
import { resolveContainer, createCanvas } from '../createBackground';

const DEFAULT_CHARSET = ' .:-=+*#%@';
const DEFAULT_COLOR = '#00ff41';
const DEFAULT_BG = '#0a0a0a';

// Simple hash-based noise (no dependencies)
function noise2d(x: number, y: number, seed: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 113.5) * 43758.5453;
    return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    // Smoothstep
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = noise2d(ix, iy, seed);
    const n10 = noise2d(ix + 1, iy, seed);
    const n01 = noise2d(ix, iy + 1, seed);
    const n11 = noise2d(ix + 1, iy + 1, seed);

    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;

    return nx0 + (nx1 - nx0) * sy;
}

function fbm(x: number, y: number, seed: number): number {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < 4; i++) {
        val += smoothNoise(x * freq, y * freq, seed + i * 17) * amp;
        amp *= 0.5;
        freq *= 2;
    }
    return val;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const c = hex.replace('#', '');
    return {
        r: parseInt(c.substring(0, 2), 16),
        g: parseInt(c.substring(2, 4), 16),
        b: parseInt(c.substring(4, 6), 16),
    };
}

export function AsciiGrid(config: AsciiGridConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;
    const canvas = createCanvas(container, width, height);
    const ctx = canvas.getContext('2d')!;

    const charset = config.charset ?? DEFAULT_CHARSET;
    const cellSize = config.cellSize ?? 16;
    const baseColor = hexToRgb(config.color ?? DEFAULT_COLOR);
    const bgColor = config.bgColor ?? DEFAULT_BG;
    const mouseRadius = config.mouseRadius ?? 12;
    const mouseIntensity = config.mouseIntensity ?? 0.8;
    const speedMul = config.speed ?? 1;
    const fontFamily = config.fontFamily ?? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

    let animationId: number | null = null;
    let mouseX = -1000;
    let mouseY = -1000;

    // Pre-compute static noise grid (computed once, never changes)
    let noiseGrid: Float32Array | null = null;
    let gridCols = 0;
    let gridRows = 0;

    function buildNoiseGrid(cols: number, rows: number) {
        gridCols = cols;
        gridRows = rows;
        noiseGrid = new Float32Array(cols * rows);
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                noiseGrid[row * cols + col] = fbm(col * 0.08, row * 0.08, 0);
            }
        }
    }

    function draw() {
        const w = canvas.width;
        const h = canvas.height;
        const cols = Math.ceil(w / cellSize);
        const rows = Math.ceil(h / cellSize);

        // Rebuild noise grid if dimensions changed
        if (cols !== gridCols || rows !== gridRows) {
            buildNoiseGrid(cols, rows);
        }

        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Mouse position in grid coords
        const rect = canvas.getBoundingClientRect();
        const mx = (mouseX - rect.left) / cellSize;
        const my = (mouseY - rect.top) / cellSize;

        const baseFontSize = cellSize * 0.8;
        ctx.font = `${baseFontSize}px ${fontFamily}`;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Static noise value
                const n = noiseGrid![row * cols + col];

                // Mouse distance in cells
                const dx = col - mx;
                const dy = row - my;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const mouseFactor = Math.max(0, 1 - dist / mouseRadius) * mouseIntensity;

                // Combined intensity
                const baseIntensity = n * 0.3 + 0.05;
                const intensity = Math.min(1, baseIntensity + mouseFactor);

                // Character selection
                const charIndex = Math.floor(intensity * (charset.length - 1));
                const char = charset[charIndex];

                // Skip space characters for performance
                if (char === ' ' && mouseFactor < 0.01) continue;

                // Alpha based on intensity
                const alpha = intensity * 0.9 + 0.1;

                // Size variation near mouse
                if (mouseFactor > 0.01) {
                    const scale = 1 + mouseFactor * 0.3;
                    ctx.font = `${baseFontSize * scale}px ${fontFamily}`;
                }

                ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;

                const x = col * cellSize + cellSize / 2;
                const y = row * cellSize + cellSize / 2;
                ctx.fillText(char, x, y);

                // Reset font if changed
                if (mouseFactor > 0.01) {
                    ctx.font = `${baseFontSize}px ${fontFamily}`;
                }
            }
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
    }

    window.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);
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

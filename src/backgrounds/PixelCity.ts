import type { PixelCityConfig, BackgroundInstance } from '../types';
import { resolveContainer, createCanvas } from '../createBackground';

function hexToRgb(hex: string): [number, number, number] {
    const c = hex.replace('#', '');
    return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
}

/* ===== Minimal building silhouettes ===== */
interface Window {
    col: number;
    row: number;
    lit: boolean;
}

interface Block {
    x: number;
    w: number;
    h: number;
    windows: Window[];
}

function generateBlocks(count: number, minH: number, maxH: number): { blocks: Block[]; totalW: number } {
    const blocks: Block[] = [];
    let x = 0;
    for (let i = 0; i < count; i++) {
        const w = 15 + Math.floor(Math.random() * 50);
        const h = minH + Math.floor(Math.random() * (maxH - minH));

        // Generate window grid
        const cols = Math.floor((w - 4) / 6);
        const rows = Math.floor((h - 6) / 8);
        const windows: Window[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Very few lit -- ~8% chance
                windows.push({ col: c, row: r, lit: Math.random() > 0.92 });
            }
        }

        blocks.push({ x, w, h, windows });
        x += w + Math.floor(Math.random() * 3);
    }
    return { blocks, totalW: x };
}

/* ===== Stars ===== */
interface Star {
    x: number;
    y: number;
    size: number;
    brightness: number;
}

function generateStars(count: number, w: number, h: number): Star[] {
    return Array.from({ length: count }, () => ({
        x: Math.random() * w * 3,
        y: Math.random() * h * 0.45,
        size: Math.random() > 0.9 ? 2 : 1,
        brightness: 0.2 + Math.random() * 0.5,
    }));
}

/* ===== Main ===== */
export function PixelCity(config: PixelCityConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;
    const canvas = createCanvas(container, width, height);
    const ctx = canvas.getContext('2d')!;

    const skyTop = hexToRgb(config.skyTop ?? '#0a0a2e');
    const skyBottom = hexToRgb(config.skyBottom ?? '#1a1a3e');
    const buildingBase = hexToRgb(config.buildingColor ?? '#0c0c1a');
    const windowColor = hexToRgb(config.windowColor ?? '#ffcc44');
    const speedMul = config.speed ?? 1;
    const starCount = config.stars ?? 100;
    const layerCount = config.layers ?? 3;

    ctx.imageSmoothingEnabled = false;

    // Generate parallax layers
    interface Layer {
        blocks: Block[];
        totalW: number;
        speedFactor: number;
        color: [number, number, number];
        maxH: number;
    }

    const layers: Layer[] = [];
    for (let i = 0; i < layerCount; i++) {
        const depth = i / (layerCount - 1 || 1); // 0=back, 1=front
        const minH = 20 + depth * 30;
        const maxH = 60 + depth * 140;
        const blockCount = 60 + i * 20;
        const { blocks, totalW } = generateBlocks(blockCount, minH, maxH);

        // Lighter in back, darker in front
        const shade = 1 - depth * 0.5;
        const color: [number, number, number] = [
            Math.floor(buildingBase[0] + (30 * shade)),
            Math.floor(buildingBase[1] + (25 * shade)),
            Math.floor(buildingBase[2] + (35 * shade)),
        ];

        layers.push({
            blocks,
            totalW,
            speedFactor: 0.15 + depth * 0.85,
            color,
            maxH,
        });
    }

    const stars = generateStars(starCount, width, height);

    let animationId: number | null = null;
    let time = 0;

    function draw() {
        const w = canvas.width;
        const h = canvas.height;
        const scroll = time * 0.4 * speedMul;

        // Sky gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `rgb(${skyTop[0]},${skyTop[1]},${skyTop[2]})`);
        grad.addColorStop(1, `rgb(${skyBottom[0]},${skyBottom[1]},${skyBottom[2]})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Stars
        for (const star of stars) {
            const sx = ((star.x - scroll * 0.03) % (w * 3) + w * 3) % (w * 3);
            if (sx > w) continue;
            ctx.fillStyle = `rgba(255,255,250,${star.brightness})`;
            ctx.fillRect(Math.floor(sx), Math.floor(star.y), star.size, star.size);
        }

        // Silhouette layers
        for (let li = 0; li < layers.length; li++) {
            const layer = layers[li];
            const isFront = li === layers.length - 1;
            const layerScroll = scroll * layer.speedFactor;
            const c = layer.color;
            ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;

            for (const block of layer.blocks) {
                const bx = ((block.x - layerScroll) % layer.totalW + layer.totalW) % layer.totalW;
                if (bx + block.w < 0 || bx > w) continue;

                const by = h - block.h;
                ctx.fillRect(Math.floor(bx), Math.floor(by), block.w, block.h);

                // Windows only on front layer, very sparse
                if (isFront) {
                    for (const win of block.windows) {
                        if (!win.lit) continue;
                        const wx = Math.floor(bx + 3 + win.col * 6);
                        const wy = Math.floor(by + 4 + win.row * 8);
                        if (wx > w || wx + 3 < 0) continue;

                        ctx.fillStyle = `rgba(${windowColor[0]},${windowColor[1]},${windowColor[2]},0.35)`;
                        ctx.fillRect(wx, wy, 3, 4);
                    }
                    // Reset fill for next block
                    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
                }
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
            canvas.remove();
        },
        resize(w: number, h: number) {
            canvas.width = w;
            canvas.height = h;
        },
    };
}

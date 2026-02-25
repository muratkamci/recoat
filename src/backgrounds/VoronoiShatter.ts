import type { VoronoiShatterConfig, BackgroundInstance } from '../types';
import { resolveContainer, createCanvas } from '../createBackground';

interface Cell {
    x: number;
    y: number;
    vx: number;
    vy: number;
    baseX: number;
    baseY: number;
}

function hexToRgb(hex: string): [number, number, number] {
    const c = hex.replace('#', '');
    return [
        parseInt(c.substring(0, 2), 16),
        parseInt(c.substring(2, 4), 16),
        parseInt(c.substring(4, 6), 16),
    ];
}

/**
 * Find the closest and second-closest cell for a pixel.
 * Returns [closestIndex, distToClosest, distToSecond].
 */
function voronoiDist(
    px: number, py: number, cells: Cell[],
): [number, number, number] {
    let minD = Infinity;
    let minD2 = Infinity;
    let minIdx = 0;

    for (let i = 0; i < cells.length; i++) {
        const dx = px - cells[i].x;
        const dy = py - cells[i].y;
        const d = dx * dx + dy * dy;
        if (d < minD) {
            minD2 = minD;
            minD = d;
            minIdx = i;
        } else if (d < minD2) {
            minD2 = d;
        }
    }

    return [minIdx, Math.sqrt(minD), Math.sqrt(minD2)];
}

export function VoronoiShatter(config: VoronoiShatterConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;
    const canvas = createCanvas(container, width, height);
    const ctx = canvas.getContext('2d')!;

    const cellCount = config.cellCount ?? 40;
    const edgeColor = hexToRgb(config.edgeColor ?? '#00eeff');
    const fillColor = hexToRgb(config.fillColor ?? '#0a0a1a');
    const accentColor = hexToRgb(config.accentColor ?? '#ff2060');
    const speedMul = config.speed ?? 1;
    const edgeOpacity = config.edgeOpacity ?? 0.6;
    const mouseRadius = config.mouseRadius ?? 150;
    const shatterIntensity = config.shatterIntensity ?? 0.5;

    let animationId: number | null = null;
    let mouseX = -1000;
    let mouseY = -1000;

    // Initialize cells
    const cells: Cell[] = [];
    for (let i = 0; i < cellCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        cells.push({
            x, y,
            baseX: x,
            baseY: y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
        });
    }

    // Render at lower resolution for performance
    const pixelStep = 2;

    function draw() {
        const w = canvas.width;
        const h = canvas.height;

        // Update cell positions (slow drift)
        for (const cell of cells) {
            cell.x += cell.vx * speedMul;
            cell.y += cell.vy * speedMul;

            // Bounce off edges
            if (cell.x < 0 || cell.x > w) cell.vx *= -1;
            if (cell.y < 0 || cell.y > h) cell.vy *= -1;
            cell.x = Math.max(0, Math.min(w, cell.x));
            cell.y = Math.max(0, Math.min(h, cell.y));
        }

        // Mouse position relative to canvas
        const rect = canvas.getBoundingClientRect();
        const mx = mouseX - rect.left;
        const my = mouseY - rect.top;

        // Shatter: push cells away from mouse
        for (const cell of cells) {
            const dx = cell.x - mx;
            const dy = cell.y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mouseRadius && dist > 0) {
                const force = (1 - dist / mouseRadius) * shatterIntensity * 3;
                cell.x += (dx / dist) * force;
                cell.y += (dy / dist) * force;
            }
        }

        // Clear
        ctx.fillStyle = `rgb(${fillColor[0]}, ${fillColor[1]}, ${fillColor[2]})`;
        ctx.fillRect(0, 0, w, h);

        // Draw voronoi cells pixel by pixel (low-res for perf)
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;

        for (let y = 0; y < h; y += pixelStep) {
            for (let x = 0; x < w; x += pixelStep) {
                const [cellIdx, d1, d2] = voronoiDist(x, y, cells);

                // Edge detection: thin border where d1 ≈ d2
                const edgeDist = d2 - d1;
                const edgeThreshold = 4;
                const isEdge = edgeDist < edgeThreshold;
                const edgeFactor = isEdge ? 1 - edgeDist / edgeThreshold : 0;

                // Mouse proximity for accent glow
                const dxm = x - mx;
                const dym = y - my;
                const distToMouse = Math.sqrt(dxm * dxm + dym * dym);
                const mouseFactor = Math.max(0, 1 - distToMouse / mouseRadius);

                // Color
                let r, g, b, a;

                if (isEdge) {
                    // Edge: blend between edge color and accent near mouse
                    const accentMix = mouseFactor * 0.8;
                    r = edgeColor[0] + (accentColor[0] - edgeColor[0]) * accentMix;
                    g = edgeColor[1] + (accentColor[1] - edgeColor[1]) * accentMix;
                    b = edgeColor[2] + (accentColor[2] - edgeColor[2]) * accentMix;
                    a = edgeFactor * edgeOpacity * 255;

                    // Brighter edges near mouse
                    a = Math.min(255, a * (1 + mouseFactor * 2));
                } else {
                    // Cell fill: subtle variation per cell + mouse glow
                    const cellShade = ((cellIdx * 73 + 17) % 20) / 20; // pseudo-random per cell
                    r = fillColor[0] + cellShade * 8 + mouseFactor * accentColor[0] * 0.08;
                    g = fillColor[1] + cellShade * 5 + mouseFactor * accentColor[1] * 0.08;
                    b = fillColor[2] + cellShade * 12 + mouseFactor * accentColor[2] * 0.08;
                    a = 255;
                }

                // Fill the pixel block
                for (let py = y; py < Math.min(y + pixelStep, h); py++) {
                    for (let px = x; px < Math.min(x + pixelStep, w); px++) {
                        const idx = (py * w + px) * 4;
                        data[idx] = r;
                        data[idx + 1] = g;
                        data[idx + 2] = b;
                        data[idx + 3] = a;
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Draw cell center dots
        for (const cell of cells) {
            const dxm = cell.x - mx;
            const dym = cell.y - my;
            const dist = Math.sqrt(dxm * dxm + dym * dym);
            const glow = Math.max(0, 1 - dist / mouseRadius);

            ctx.beginPath();
            ctx.arc(cell.x, cell.y, 1.5 + glow * 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${edgeColor[0]}, ${edgeColor[1]}, ${edgeColor[2]}, ${0.3 + glow * 0.7})`;
            ctx.fill();
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

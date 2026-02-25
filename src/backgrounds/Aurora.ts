import type { AuroraConfig, BackgroundInstance } from '../types';
import { resolveContainer, createCanvas } from '../createBackground';

const DEFAULT_COLORS = ['#00ff80', '#00c8ff', '#8000ff'];
const DEFAULT_BG_COLOR = '#0a0a1a';

/** Parse any CSS color to an { r, g, b } object via an offscreen canvas */
function parseColor(color: string): { r: number; g: number; b: number } {
    if (typeof OffscreenCanvas !== 'undefined') {
        const ctx = new OffscreenCanvas(1, 1).getContext('2d')!;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return { r, g, b };
    }
    // Fallback for environments without OffscreenCanvas
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
}

const BASE_LAYERS = [
    { opacity: 0.08, speed: 0.3, amplitude: 80, yOffset: 0.3 },
    { opacity: 0.06, speed: 0.5, amplitude: 60, yOffset: 0.4 },
    { opacity: 0.05, speed: 0.2, amplitude: 100, yOffset: 0.35 },
];

export function Aurora(config: AuroraConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;
    const canvas = createCanvas(container, width, height);
    const ctx = canvas.getContext('2d')!;

    const colors = (config.colors ?? DEFAULT_COLORS).map(parseColor);
    const speedMul = config.speed ?? 1.9;
    const brightness = config.brightness ?? 2.4;
    const bgColor = config.bgColor ?? DEFAULT_BG_COLOR;
    const ampMul = config.amplitude ?? 1.7;

    let animationId: number | null = null;
    let time = 0;

    function draw() {
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);

        // Aurora layers
        for (let i = 0; i < BASE_LAYERS.length; i++) {
            const layer = BASE_LAYERS[i];
            const { r, g, b } = colors[i % colors.length];
            const alpha = layer.opacity * brightness;
            const amp = layer.amplitude * ampMul;
            const spd = layer.speed * speedMul;

            ctx.beginPath();
            ctx.moveTo(0, h);

            for (let x = 0; x <= w; x += 2) {
                const y =
                    h * layer.yOffset +
                    Math.sin((x * 0.003) + (time * spd)) * amp +
                    Math.sin((x * 0.007) + (time * spd * 0.5)) * (amp * 0.5);
                ctx.lineTo(x, y);
            }

            ctx.lineTo(w, h);
            ctx.closePath();

            const gradient = ctx.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        time += 0.016;
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

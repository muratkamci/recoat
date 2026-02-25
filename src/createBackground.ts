import type { BackgroundConfig, BackgroundInstance, BackgroundFactory } from './types';

export function resolveContainer(container: HTMLElement | string): HTMLElement {
    if (typeof container === 'string') {
        const el = document.querySelector<HTMLElement>(container);
        if (!el) throw new Error(`[Recoat] Container not found: ${container}`);
        return el;
    }
    return container;
}

export function createCanvas(container: HTMLElement, width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';

    const computedPosition = window.getComputedStyle(container).position;
    if (computedPosition === 'static') {
        container.style.position = 'relative';
    }
    container.appendChild(canvas);

    return canvas;
}

export function createBackground(factory: BackgroundFactory, config: BackgroundConfig): BackgroundInstance {
    return factory(config);
}

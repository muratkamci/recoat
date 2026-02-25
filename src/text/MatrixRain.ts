import type { MatrixRainConfig, TextAnimationInstance } from '../types';

function resolveElement(el: HTMLElement | string): HTMLElement {
    if (typeof el === 'string') {
        const found = document.querySelector<HTMLElement>(el);
        if (!found) throw new Error(`[Recoat] Element not found: ${el}`);
        return found;
    }
    return el;
}

const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function MatrixRain(config: MatrixRainConfig): TextAnimationInstance {
    const element = resolveElement(config.element);
    const text = config.text ?? element.textContent ?? '';
    const color = config.color ?? '#00ff41';
    const speed = config.speed ?? 60;
    const cols = config.columns || text.length;
    const settleDuration = config.settleDuration ?? 3000;
    const pauseDuration = config.pauseDuration ?? 2000;

    const originalHTML = element.innerHTML;
    const origStyle = element.getAttribute('style') || '';

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let pauseTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    // Grid: rows of characters falling per column
    const rows = 6; // number of visible rain rows above the text
    let grid: string[][] = [];
    let settled: boolean[] = [];
    let settledCount = 0;

    const charSpans: HTMLSpanElement[] = [];
    const rainSpans: HTMLSpanElement[][] = [];
    let container: HTMLDivElement | null = null;

    function randomChar(): string {
        return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
    }

    function setup() {
        element.innerHTML = '';
        element.style.display = 'inline-block';
        element.style.position = 'relative';
        element.style.overflow = 'visible';

        // Create container for rain + text
        container = document.createElement('div');
        container.style.cssText = 'display: inline-block; position: relative;';

        // Create rain rows above
        rainSpans.length = 0;
        for (let r = 0; r < rows; r++) {
            const rowSpans: HTMLSpanElement[] = [];
            const rowDiv = document.createElement('div');
            rowDiv.style.cssText = `display: block; white-space: nowrap; height: 1.2em; line-height: 1.2em; overflow: hidden;`;

            for (let c = 0; c < cols; c++) {
                const span = document.createElement('span');
                span.style.cssText = `display: inline-block; width: 1ch; text-align: center; color: ${color}; opacity: ${0.1 + (r / rows) * 0.3};`;
                span.textContent = randomChar();
                rowDiv.appendChild(span);
                rowSpans.push(span);
            }

            container.appendChild(rowDiv);
            rainSpans.push(rowSpans);
        }

        // Create text row
        const textDiv = document.createElement('div');
        textDiv.style.cssText = 'display: block; white-space: nowrap; height: 1.2em; line-height: 1.2em;';

        charSpans.length = 0;
        for (let c = 0; c < cols; c++) {
            const span = document.createElement('span');
            span.style.cssText = `display: inline-block; width: 1ch; text-align: center; color: ${color};`;
            span.textContent = randomChar();
            textDiv.appendChild(span);
            charSpans.push(span);
        }

        container.appendChild(textDiv);
        element.appendChild(container);

        // Init state
        grid = [];
        for (let r = 0; r < rows; r++) {
            grid.push(Array.from({ length: cols }, () => randomChar()));
        }
        settled = new Array(cols).fill(false);
        settledCount = 0;
    }

    function tick() {
        if (destroyed) return;

        // Shift rain down: each column's characters shift
        for (let c = 0; c < cols; c++) {
            // Shift rows down
            for (let r = rows - 1; r > 0; r--) {
                grid[r][c] = grid[r - 1][c];
            }
            grid[0][c] = randomChar();

            // Update rain spans
            for (let r = 0; r < rows; r++) {
                rainSpans[r][c].textContent = grid[r][c];
            }

            // Update text row (scramble if not settled)
            if (!settled[c]) {
                charSpans[c].textContent = randomChar();
                charSpans[c].style.opacity = '0.7';
                charSpans[c].style.textShadow = 'none';
            }
        }
    }

    function settleColumn(index: number) {
        if (index >= cols || destroyed) return;
        settled[index] = true;
        settledCount++;

        const targetChar = index < text.length ? text[index] : ' ';
        charSpans[index].textContent = targetChar;
        charSpans[index].style.opacity = '1';
        charSpans[index].style.textShadow = `0 0 8px ${color}, 0 0 16px ${color}`;

        // Fade out rain above settled column
        for (let r = 0; r < rows; r++) {
            rainSpans[r][index].style.opacity = '0.05';
        }
    }

    function startSettle() {
        if (destroyed) return;

        const settleInterval = settleDuration / cols;
        let i = 0;

        function settleNext() {
            if (destroyed || i >= cols) {
                // All settled — pause then restart
                if (!destroyed) {
                    pauseTimer = setTimeout(() => {
                        if (!destroyed) startCycle();
                    }, pauseDuration);
                }
                return;
            }
            settleColumn(i);
            i++;
            settleTimer = setTimeout(settleNext, settleInterval);
        }

        settleNext();
    }

    function startCycle() {
        if (destroyed) return;

        setup();

        intervalId = setInterval(tick, speed);

        // After a brief rain period, start settling
        settleTimer = setTimeout(() => {
            startSettle();
        }, settleDuration * 0.4);
    }

    function clearAll() {
        if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
        if (settleTimer !== null) { clearTimeout(settleTimer); settleTimer = null; }
        if (pauseTimer !== null) { clearTimeout(pauseTimer); pauseTimer = null; }
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

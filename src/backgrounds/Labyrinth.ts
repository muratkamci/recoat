import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass, OutputPass } from 'three/examples/jsm/Addons.js';
import type { LabyrinthConfig, BackgroundInstance } from '../types';
import { resolveContainer } from '../createBackground';

/* ===== Helpers ===== */
function hexToColor(hex: string): THREE.Color {
    return new THREE.Color(hex);
}

function isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 768;
}

/* ===== Maze data structures ===== */
interface MazeCell {
    row: number;
    col: number;
    walls: { N: boolean; E: boolean; S: boolean; W: boolean };
    visited: boolean;
}

type Direction = 'N' | 'E' | 'S' | 'W';

const OPPOSITE: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const DIR_OFFSETS: Record<Direction, [number, number]> = {
    N: [-1, 0],
    S: [1, 0],
    E: [0, 1],
    W: [0, -1],
};
const DIRECTIONS: Direction[] = ['N', 'E', 'S', 'W'];

/* ===== Maze generation (Recursive Backtracking / iterative DFS) ===== */
function generateMaze(rows: number, cols: number): MazeCell[][] {
    const grid: MazeCell[][] = [];
    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
            grid[r][c] = {
                row: r,
                col: c,
                walls: { N: true, E: true, S: true, W: true },
                visited: false,
            };
        }
    }

    const stack: MazeCell[] = [];
    const start = grid[0][0];
    start.visited = true;
    stack.push(start);

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const neighbors: { cell: MazeCell; dir: Direction }[] = [];

        for (const dir of DIRECTIONS) {
            const [dr, dc] = DIR_OFFSETS[dir];
            const nr = current.row + dr;
            const nc = current.col + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !grid[nr][nc].visited) {
                neighbors.push({ cell: grid[nr][nc], dir });
            }
        }

        if (neighbors.length > 0) {
            const { cell: next, dir } = neighbors[Math.floor(Math.random() * neighbors.length)];
            current.walls[dir] = false;
            next.walls[OPPOSITE[dir]] = false;
            next.visited = true;
            stack.push(next);
        } else {
            stack.pop();
        }
    }

    return grid;
}

/* ===== DFS Exploration path ===== */
function generateExplorationPath(maze: MazeCell[][]): { row: number; col: number }[] {
    const rows = maze.length;
    const cols = maze[0].length;
    const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    const path: { row: number; col: number }[] = [];

    function dfs(r: number, c: number) {
        visited[r][c] = true;
        path.push({ row: r, col: c });

        // Shuffle directions for varied exploration
        const dirs = [...DIRECTIONS];
        for (let i = dirs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }

        for (const dir of dirs) {
            const [dr, dc] = DIR_OFFSETS[dir];
            const nr = r + dr;
            const nc = c + dc;
            if (
                nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                !visited[nr][nc] &&
                !maze[r][c].walls[dir]
            ) {
                dfs(nr, nc);
                // Backtrack: return to current cell
                path.push({ row: r, col: c });
            }
        }
    }

    dfs(0, 0);
    return path;
}

/* ===== Camera keyframe generation ===== */
interface PathKeyframe {
    position: THREE.Vector3;
    lookAt: THREE.Vector3;
    speedFactor: number; // 1.0 normal, 0.5 slow (dead-end), 1.3 fast (backtrack)
}

function buildKeyframes(
    explorationPath: { row: number; col: number }[],
    corridorW: number,
    wallH: number,
): PathKeyframe[] {
    const keyframes: PathKeyframe[] = [];
    const eyeY = wallH * 0.4;

    function cellPos(r: number, c: number): THREE.Vector3 {
        return new THREE.Vector3(c * corridorW + corridorW / 2, eyeY, r * corridorW + corridorW / 2);
    }

    for (let i = 0; i < explorationPath.length; i++) {
        const curr = explorationPath[i];
        const pos = cellPos(curr.row, curr.col);

        // Look toward next cell
        let lookTarget: THREE.Vector3;
        if (i < explorationPath.length - 1) {
            const next = explorationPath[i + 1];
            lookTarget = cellPos(next.row, next.col);
        } else if (i > 0) {
            const prev = explorationPath[i - 1];
            const dir = pos.clone().sub(cellPos(prev.row, prev.col));
            lookTarget = pos.clone().add(dir);
        } else {
            lookTarget = pos.clone().add(new THREE.Vector3(0, 0, 1));
        }

        // Uniform speed — smooth lookAt handles natural head turning
        keyframes.push({ position: pos, lookAt: lookTarget, speedFactor: 1.0 });
    }

    return keyframes;
}

/* ===== Maze geometry (merged LineSegments + solid wall panels) ===== */
function pushSegment(arr: number[], x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    arr.push(x1, y1, z1, x2, y2, z2);
}

// Push two triangles forming a quad (for solid wall panels)
function pushQuad(
    arr: number[],
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
) {
    // Triangle 1: a-b-c
    arr.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    // Triangle 2: a-c-d
    arr.push(ax, ay, az, cx, cy, cz, dx, dy, dz);
}

function buildMazeGeometry(
    maze: MazeCell[][],
    corridorW: number,
    wallH: number,
): {
    wallVerts: Float32Array;
    floorVerts: Float32Array;
    ceilingVerts: Float32Array;
    solidVerts: Float32Array;
    floorPanelVerts: Float32Array;
    ceilingPanelVerts: Float32Array;
} {
    const rows = maze.length;
    const cols = maze[0].length;
    const wallArr: number[] = [];
    const floorArr: number[] = [];
    const ceilingArr: number[] = [];
    const solidArr: number[] = [];
    const floorPanelArr: number[] = [];
    const ceilingPanelArr: number[] = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = c * corridorW;
            const z = r * corridorW;
            const cell = maze[r][c];

            // North wall
            if (cell.walls.N) {
                pushSegment(wallArr, x, 0, z, x + corridorW, 0, z);
                pushSegment(wallArr, x, wallH, z, x + corridorW, wallH, z);
                pushSegment(wallArr, x, 0, z, x, wallH, z);
                pushSegment(wallArr, x + corridorW, 0, z, x + corridorW, wallH, z);
                pushSegment(wallArr, x, wallH * 0.5, z, x + corridorW, wallH * 0.5, z);
                // Solid panel (opaque quad blocking view)
                pushQuad(solidArr,
                    x, 0, z,
                    x + corridorW, 0, z,
                    x + corridorW, wallH, z,
                    x, wallH, z,
                );
            }

            // East wall
            if (cell.walls.E) {
                pushSegment(wallArr, x + corridorW, 0, z, x + corridorW, 0, z + corridorW);
                pushSegment(wallArr, x + corridorW, wallH, z, x + corridorW, wallH, z + corridorW);
                pushSegment(wallArr, x + corridorW, 0, z, x + corridorW, wallH, z);
                pushSegment(wallArr, x + corridorW, 0, z + corridorW, x + corridorW, wallH, z + corridorW);
                pushSegment(wallArr, x + corridorW, wallH * 0.5, z, x + corridorW, wallH * 0.5, z + corridorW);
                pushQuad(solidArr,
                    x + corridorW, 0, z,
                    x + corridorW, 0, z + corridorW,
                    x + corridorW, wallH, z + corridorW,
                    x + corridorW, wallH, z,
                );
            }

            // South wall: only for last row (boundary)
            if (r === rows - 1 && cell.walls.S) {
                pushSegment(wallArr, x, 0, z + corridorW, x + corridorW, 0, z + corridorW);
                pushSegment(wallArr, x, wallH, z + corridorW, x + corridorW, wallH, z + corridorW);
                pushSegment(wallArr, x, 0, z + corridorW, x, wallH, z + corridorW);
                pushSegment(wallArr, x + corridorW, 0, z + corridorW, x + corridorW, wallH, z + corridorW);
                pushSegment(wallArr, x, wallH * 0.5, z + corridorW, x + corridorW, wallH * 0.5, z + corridorW);
                pushQuad(solidArr,
                    x, 0, z + corridorW,
                    x + corridorW, 0, z + corridorW,
                    x + corridorW, wallH, z + corridorW,
                    x, wallH, z + corridorW,
                );
            }

            // West wall: only for first column (boundary)
            if (c === 0 && cell.walls.W) {
                pushSegment(wallArr, x, 0, z, x, 0, z + corridorW);
                pushSegment(wallArr, x, wallH, z, x, wallH, z + corridorW);
                pushSegment(wallArr, x, 0, z, x, wallH, z);
                pushSegment(wallArr, x, 0, z + corridorW, x, wallH, z + corridorW);
                pushSegment(wallArr, x, wallH * 0.5, z, x, wallH * 0.5, z + corridorW);
                pushQuad(solidArr,
                    x, 0, z,
                    x, 0, z + corridorW,
                    x, wallH, z + corridorW,
                    x, wallH, z,
                );
            }

            // Floor wireframe lines per cell
            const cx = x + corridorW / 2;
            const cz = z + corridorW / 2;
            pushSegment(floorArr, x, 0.01, cz, x + corridorW, 0.01, cz);
            pushSegment(floorArr, cx, 0.01, z, cx, 0.01, z + corridorW);

            // Ceiling wireframe lines
            pushSegment(ceilingArr, x, wallH, cz, x + corridorW, wallH, cz);
            pushSegment(ceilingArr, cx, wallH, z, cx, wallH, z + corridorW);

            // Solid floor panel per cell
            pushQuad(floorPanelArr,
                x, 0, z,
                x + corridorW, 0, z,
                x + corridorW, 0, z + corridorW,
                x, 0, z + corridorW,
            );

            // Solid ceiling panel per cell
            pushQuad(ceilingPanelArr,
                x, wallH, z,
                x + corridorW, wallH, z,
                x + corridorW, wallH, z + corridorW,
                x, wallH, z + corridorW,
            );
        }
    }

    return {
        wallVerts: new Float32Array(wallArr),
        floorVerts: new Float32Array(floorArr),
        ceilingVerts: new Float32Array(ceilingArr),
        solidVerts: new Float32Array(solidArr),
        floorPanelVerts: new Float32Array(floorPanelArr),
        ceilingPanelVerts: new Float32Array(ceilingPanelArr),
    };
}

/* ===== Particles ===== */
function buildParticles(
    maze: MazeCell[][],
    corridorW: number,
    wallH: number,
    color: THREE.Color,
): THREE.Points {
    const rows = maze.length;
    const cols = maze[0].length;
    const count = Math.floor(rows * cols * 0.8);
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        positions[i * 3] = c * corridorW + corridorW / 2 + (Math.random() - 0.5) * corridorW * 0.6;
        positions[i * 3 + 1] = 0.3 + Math.random() * (wallH - 0.6);
        positions[i * 3 + 2] = r * corridorW + corridorW / 2 + (Math.random() - 0.5) * corridorW * 0.6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
        color,
        size: 0.08,
        transparent: true,
        opacity: 0.4,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    return new THREE.Points(geo, mat);
}

/* ===== Main ===== */
export function Labyrinth(config: LabyrinthConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;

    const wallColor = hexToColor(config.wallColor ?? '#00ffaa');
    const wallColor2 = hexToColor(config.wallColor2 ?? '#ff00aa');
    const wallColor3 = hexToColor(config.wallColor3 ?? '#00aaff');
    const wallColors = [wallColor, wallColor2, wallColor3];
    const floorColor = hexToColor(config.floorColor ?? '#1a3a2a');
    const bgColor = config.bgColor ?? '#050510';
    const speedMul = config.speed ?? 1;
    const fov = config.fov ?? 75;
    const fogDensity = config.fog ?? 0.5;
    const corridorW = config.corridorWidth ?? 3;
    const wallH = config.wallHeight ?? 4;

    const mobile = isMobile();
    const mazeSize = mobile ? 10 : 15;

    // Renderer
    const dpr = Math.min(window.devicePixelRatio, 2);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(new THREE.Color(bgColor), 1);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.2;

    const cvs = renderer.domElement;
    cvs.style.position = 'absolute';
    cvs.style.top = '0';
    cvs.style.left = '0';
    cvs.style.width = '100%';
    cvs.style.height = '100%';
    cvs.style.pointerEvents = 'none';

    const computedPosition = window.getComputedStyle(container).position;
    if (computedPosition === 'static') container.style.position = 'relative';
    container.appendChild(cvs);

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(bgColor, 0.03 + fogDensity * 0.07);

    // Camera
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 200);

    // Generate maze
    const maze = generateMaze(mazeSize, mazeSize);

    // Build geometry
    const { wallVerts, floorVerts, ceilingVerts, solidVerts, floorPanelVerts, ceilingPanelVerts } =
        buildMazeGeometry(maze, corridorW, wallH);

    const bgCol = new THREE.Color(bgColor);

    // Solid wall panels (opaque, block view through walls) — rendered first
    const solidGeo = new THREE.BufferGeometry();
    solidGeo.setAttribute('position', new THREE.Float32BufferAttribute(solidVerts, 3));
    solidGeo.computeVertexNormals();
    const solidMat = new THREE.MeshBasicMaterial({ color: bgCol, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    scene.add(new THREE.Mesh(solidGeo, solidMat));

    // Solid floor panel
    const floorPanelGeo = new THREE.BufferGeometry();
    floorPanelGeo.setAttribute('position', new THREE.Float32BufferAttribute(floorPanelVerts, 3));
    floorPanelGeo.computeVertexNormals();
    const floorPanelMat = new THREE.MeshBasicMaterial({ color: bgCol, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    scene.add(new THREE.Mesh(floorPanelGeo, floorPanelMat));

    // Solid ceiling panel
    const ceilingPanelGeo = new THREE.BufferGeometry();
    ceilingPanelGeo.setAttribute('position', new THREE.Float32BufferAttribute(ceilingPanelVerts, 3));
    ceilingPanelGeo.computeVertexNormals();
    const ceilingPanelMat = new THREE.MeshBasicMaterial({ color: bgCol, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    scene.add(new THREE.Mesh(ceilingPanelGeo, ceilingPanelMat));

    // Neon wireframe wall lines (rendered on top of solid panels)
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallVerts, 3));
    const wallMat = new THREE.LineBasicMaterial({ color: wallColor, transparent: true, opacity: 0.9 });
    scene.add(new THREE.LineSegments(wallGeo, wallMat));

    // Floor wireframe lines
    const floorGeo = new THREE.BufferGeometry();
    floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(floorVerts, 3));
    const floorMat = new THREE.LineBasicMaterial({ color: floorColor, transparent: true, opacity: 0.2 });
    scene.add(new THREE.LineSegments(floorGeo, floorMat));

    // Ceiling wireframe lines
    const ceilingGeo = new THREE.BufferGeometry();
    ceilingGeo.setAttribute('position', new THREE.Float32BufferAttribute(ceilingVerts, 3));
    const ceilingMat = new THREE.LineBasicMaterial({ color: wallColor, transparent: true, opacity: 0.15 });
    scene.add(new THREE.LineSegments(ceilingGeo, ceilingMat));

    // Particles
    const particles = buildParticles(maze, corridorW, wallH, wallColor);
    const particleMat = (particles as THREE.Points).material as THREE.PointsMaterial;
    scene.add(particles);

    // Color cycling helper
    const COLOR_CYCLE_DURATION = 5.0; // seconds per color
    const cycleColor = new THREE.Color();

    // Exploration path & keyframes
    const explorationPath = generateExplorationPath(maze);
    const keyframes = buildKeyframes(explorationPath, corridorW, wallH);

    // Pre-compute cumulative times for fast lookup
    const BASE_STEP_TIME = 0.8;
    const cumulativeTimes: number[] = [0];
    for (let i = 0; i < keyframes.length - 1; i++) {
        cumulativeTimes.push(cumulativeTimes[i] + BASE_STEP_TIME / keyframes[i].speedFactor);
    }
    const totalPathTime = cumulativeTimes[cumulativeTimes.length - 1];

    // Binary search for keyframe index
    function findKeyframeIndex(time: number): number {
        let lo = 0;
        let hi = cumulativeTimes.length - 2;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (cumulativeTimes[mid] <= time) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    // Post-processing (bloom)
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width * dpr, height * dpr),
        0.8,   // strength
        0.2,   // radius
        0.0,   // threshold — all visible lines glow regardless of color
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // Animation state
    let animationId: number | null = null;
    const clock = new THREE.Clock();

    // Smooth camera quaternion
    const currentLookAt = new THREE.Vector3();
    let lookInitialized = false;

    function animate() {
        animationId = requestAnimationFrame(animate);

        const elapsed = clock.getElapsedTime() * speedMul;
        const loopedTime = elapsed % totalPathTime;

        const idx = findKeyframeIndex(loopedTime);
        const segmentStart = cumulativeTimes[idx];
        const segmentDuration = BASE_STEP_TIME / keyframes[idx].speedFactor;
        const localT = Math.min(1, (loopedTime - segmentStart) / segmentDuration);

        const curr = keyframes[idx];
        const next = keyframes[Math.min(idx + 1, keyframes.length - 1)];

        // Interpolate position
        const pos = curr.position.clone().lerp(next.position, localT);

        // Interpolate lookAt target
        const targetLook = curr.lookAt.clone().lerp(next.lookAt, localT);

        // Smooth lookAt (avoid jarring snaps)
        if (!lookInitialized) {
            currentLookAt.copy(targetLook);
            lookInitialized = true;
        } else {
            currentLookAt.lerp(targetLook, 0.12);
        }

        // Head bob
        const walkPhase = elapsed * 1.2;
        const bobY = Math.sin(walkPhase * 3.2) * 0.04;
        const bobX = Math.sin(walkPhase * 1.6) * 0.02;

        camera.position.set(pos.x + bobX, pos.y + bobY, pos.z);
        camera.lookAt(currentLookAt.x, currentLookAt.y - 0.1, currentLookAt.z);

        // Smooth color cycling between 3 wall colors
        const totalCycleDuration = COLOR_CYCLE_DURATION * wallColors.length;
        const cycleProgress = (elapsed % totalCycleDuration) / COLOR_CYCLE_DURATION;
        const colorIdx = Math.floor(cycleProgress) % wallColors.length;
        const colorNext = (colorIdx + 1) % wallColors.length;
        const colorT = cycleProgress - Math.floor(cycleProgress);
        // Smooth ease for color transition
        const colorEase = colorT * colorT * (3 - 2 * colorT);
        cycleColor.copy(wallColors[colorIdx]).lerp(wallColors[colorNext], colorEase);
        wallMat.color.copy(cycleColor);
        ceilingMat.color.copy(cycleColor);
        particleMat.color.copy(cycleColor);

        composer.render();
    }

    function handleResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        composer.setSize(w, h);
        bloomPass.resolution.set(w * dpr, h * dpr);
    }

    if (config.responsive !== false) {
        window.addEventListener('resize', handleResize);
    }

    return {
        start() {
            if (!animationId) {
                clock.start();
                animate();
            }
        },
        stop() {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
                clock.stop();
            }
        },
        destroy() {
            this.stop();
            window.removeEventListener('resize', handleResize);
            scene.traverse((obj) => {
                if ((obj as any).geometry) (obj as any).geometry.dispose();
                if ((obj as any).material) {
                    const mat = (obj as any).material;
                    if (Array.isArray(mat)) mat.forEach((m: THREE.Material) => m.dispose());
                    else (mat as THREE.Material).dispose();
                }
            });
            composer.dispose();
            renderer.dispose();
            cvs.remove();
        },
        resize(w: number, h: number) {
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            composer.setSize(w, h);
            bloomPass.resolution.set(w * dpr, h * dpr);
        },
    };
}

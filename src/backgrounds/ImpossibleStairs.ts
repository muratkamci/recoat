import * as THREE from 'three';
import type { ImpossibleStairsConfig, BackgroundInstance } from '../types';
import { resolveContainer } from '../createBackground';

function hexToColor(hex: string): THREE.Color {
    return new THREE.Color(hex);
}

/**
 * Build a looping staircase path.
 * Stairs go forward and up, then seamlessly loop.
 * We build enough stairs to fill the view and recycle them.
 */
function buildStairs(
    count: number,
    color: THREE.Color,
): { group: THREE.Group; stepPositions: THREE.Vector3[]; totalLength: number } {
    const group = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
    const dimMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 });

    const stepW = 2.4;   // width (left-right)
    const stepD = 0.8;   // depth (forward)
    const stepH = 0.35;  // height rise

    const stepPositions: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
        const z = -i * stepD;
        const y = i * stepH;

        stepPositions.push(new THREE.Vector3(0, y + stepH / 2, z - stepD / 2));

        const hw = stepW / 2;

        // Step top surface edges
        const topPts = [
            new THREE.Vector3(-hw, y + stepH, z),
            new THREE.Vector3(hw, y + stepH, z),
            new THREE.Vector3(hw, y + stepH, z - stepD),
            new THREE.Vector3(-hw, y + stepH, z - stepD),
            new THREE.Vector3(-hw, y + stepH, z),
        ];

        // Riser (front face)
        const riserPts = [
            new THREE.Vector3(-hw, y, z),
            new THREE.Vector3(-hw, y + stepH, z),
            new THREE.Vector3(hw, y + stepH, z),
            new THREE.Vector3(hw, y, z),
        ];

        // Side edges
        const leftSide = [
            new THREE.Vector3(-hw, y, z),
            new THREE.Vector3(-hw, y, z - stepD),
            new THREE.Vector3(-hw, y + stepH, z - stepD),
        ];
        const rightSide = [
            new THREE.Vector3(hw, y, z),
            new THREE.Vector3(hw, y, z - stepD),
            new THREE.Vector3(hw, y + stepH, z - stepD),
        ];

        // Main step wireframe
        for (const pts of [topPts, riserPts]) {
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            group.add(new THREE.Line(geo, material));
        }

        // Side lines (dimmer)
        for (const pts of [leftSide, rightSide]) {
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            group.add(new THREE.Line(geo, dimMaterial));
        }
    }

    return {
        group,
        stepPositions,
        totalLength: count * stepD,
    };
}

/**
 * Build floating particles along the path for atmosphere
 */
function buildParticles(count: number, spread: number, color: THREE.Color): THREE.Points {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * spread;
        positions[i * 3 + 1] = Math.random() * spread * 0.5;
        positions[i * 3 + 2] = -Math.random() * spread;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
        color,
        size: 0.03,
        transparent: true,
        opacity: 0.3,
        sizeAttenuation: true,
    });

    return new THREE.Points(geo, mat);
}

function isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 768;
}

export function ImpossibleStairs(config: ImpossibleStairsConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;

    const lineColor = hexToColor(config.color ?? '#00ffaa');
    const bgColor = config.bgColor ?? '#050510';
    const speedMul = config.speed ?? 1;
    const segmentCount = config.segments ?? 12;
    const stairCount = segmentCount * 6; // enough to fill view and loop

    // Renderer
    const mobile = isMobile();
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(mobile ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(new THREE.Color(bgColor), 1);

    const cvs = renderer.domElement;
    cvs.style.position = 'absolute';
    cvs.style.top = '0';
    cvs.style.left = '0';
    cvs.style.width = '100%';
    cvs.style.height = '100%';
    cvs.style.pointerEvents = 'none';

    const computedPosition = window.getComputedStyle(container).position;
    if (computedPosition === 'static') {
        container.style.position = 'relative';
    }
    container.appendChild(cvs);

    // Scene
    const scene = new THREE.Scene();

    // Fog for depth
    scene.fog = new THREE.FogExp2(bgColor, 0.04);

    // Camera -- FPS perspective
    const fov = config.fov ?? 65;
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 200);

    // Build stairs
    const { group: stairGroup, totalLength } = buildStairs(stairCount, lineColor);
    scene.add(stairGroup);

    // Duplicate stairs offset for seamless loop
    const stairGroup2 = stairGroup.clone();
    stairGroup2.position.z = -totalLength;
    stairGroup2.position.y = stairCount * 0.35;
    scene.add(stairGroup2);

    // Particles
    const particles = buildParticles(300, 12, lineColor);
    scene.add(particles);

    // Step dimensions for camera path
    const stepD = 0.8;
    const stepH = 0.35;
    const eyeHeight = 1.4;

    // Animation
    let animationId: number | null = null;
    const clock = new THREE.Clock();

    function animate() {
        animationId = requestAnimationFrame(animate);

        const t = clock.getElapsedTime() * speedMul;

        // Camera walks forward along stairs (loops)
        const walkSpeed = 1.8;
        const progress = (t * walkSpeed) % totalLength;
        const stepIndex = progress / stepD;

        const camZ = -progress;
        const camY = stepIndex * stepH + eyeHeight;

        // Subtle head bob
        const bobY = Math.sin(t * walkSpeed * 3.5) * 0.04;
        const bobX = Math.sin(t * walkSpeed * 1.75) * 0.03;

        camera.position.set(bobX, camY + bobY, camZ);

        // Look ahead and slightly down
        const lookAhead = 4;
        const lookStepIndex = (progress + lookAhead) / stepD;
        const lookY = lookStepIndex * stepH + eyeHeight - 0.3;
        camera.lookAt(bobX * 0.5, lookY, camZ - lookAhead);

        // Move particles with camera roughly
        particles.position.z = camZ;
        particles.position.y = camY - eyeHeight;

        renderer.render(scene, camera);
    }

    function handleResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
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
                if ((obj as THREE.Line).geometry) {
                    (obj as THREE.Line).geometry.dispose();
                }
                if ((obj as THREE.Line).material) {
                    const mat = (obj as THREE.Line).material;
                    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
                    else (mat as THREE.Material).dispose();
                }
            });
            renderer.dispose();
            cvs.remove();
        },
        resize(w: number, h: number) {
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        },
    };
}

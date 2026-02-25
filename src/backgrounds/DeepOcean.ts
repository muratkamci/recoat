import * as THREE from 'three';
import { EffectComposer, RenderPass, ShaderPass, OutputPass } from 'three/examples/jsm/Addons.js';
import type { DeepOceanConfig, BackgroundInstance } from '../types';
import { resolveContainer } from '../createBackground';

/* ===== Shaders ===== */

const godRayVert = `
uniform float uTime;
attribute float aPhase;
varying vec2 vUv;
varying float vAlpha;

void main() {
    vUv = uv;
    vec3 pos = position;
    float sway = sin(uTime * 0.3 + aPhase) * 0.8 + sin(uTime * 0.17 + aPhase * 2.3) * 0.4;
    pos.x += sway * (1.0 - uv.y);
    vAlpha = 0.85 + sin(uTime * 0.5 + aPhase * 1.2) * 0.15;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const godRayFrag = `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
varying float vAlpha;

void main() {
    float edgeFade = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0);
    float vertFade = pow(vUv.y, 0.5) * (1.0 - pow(1.0 - vUv.y, 4.0));
    float alpha = edgeFade * vertFade * uIntensity * vAlpha * 0.12;
    gl_FragColor = vec4(uColor, alpha);
}
`;

const underwaterTintShader = {
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 uTintColor;
        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            color.rgb = mix(color.rgb, uTintColor, 0.08);
            float vignette = 1.0 - smoothstep(0.4, 1.3, length(vUv - 0.5) * 1.8);
            color.rgb *= vignette;
            gl_FragColor = color;
        }
    `,
};

/* ===== Helpers ===== */

function hexToVec3(hex: string): [number, number, number] {
    const c = hex.replace('#', '');
    return [
        parseInt(c.substring(0, 2), 16) / 255,
        parseInt(c.substring(2, 4), 16) / 255,
        parseInt(c.substring(4, 6), 16) / 255,
    ];
}

function isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 768;
}

/* ===== Geometry ===== */

function buildFishGeometry(): THREE.BufferGeometry {
    const verts = new Float32Array([
        // Body (diamond, 8 tris)
        1.0, 0.0, 0.0,   0.0, 0.35, 0.2,   0.0, 0.0, 0.35,
        1.0, 0.0, 0.0,   0.0, 0.0, 0.35,    0.0,-0.35, 0.2,
        1.0, 0.0, 0.0,   0.0,-0.35,-0.2,    0.0, 0.0,-0.35,
        1.0, 0.0, 0.0,   0.0, 0.0,-0.35,    0.0, 0.35,-0.2,
       -0.6, 0.0, 0.0,   0.0, 0.0, 0.35,    0.0, 0.35, 0.2,
       -0.6, 0.0, 0.0,   0.0,-0.35, 0.2,    0.0, 0.0, 0.35,
       -0.6, 0.0, 0.0,   0.0, 0.0,-0.35,    0.0,-0.35,-0.2,
       -0.6, 0.0, 0.0,   0.0, 0.35,-0.2,    0.0, 0.0,-0.35,
        // Tail (2 tris)
       -0.6, 0.0, 0.0,  -1.1, 0.35, 0.0,   -1.1,-0.35, 0.0,
       -0.6, 0.0, 0.0,  -1.1,-0.35, 0.0,   -1.1, 0.35, 0.0,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
}

/* ===== Main ===== */

export function DeepOcean(config: DeepOceanConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;

    // Config defaults
    const deepColor = config.deepColor ?? '#3e5b7e';
    const shallowColor = config.shallowColor ?? '#0a4d7b';
    const lightColor = config.lightColor ?? '#4a9eff';
    const floorColor = config.floorColor ?? '#1a1510';
    const fishCount = config.fishCount ?? 12;
    const particleCount = config.particleCount ?? 500;
    const speedMul = config.speed ?? 1;
    const lightIntensity = config.lightIntensity ?? 0.5;
    const fov = config.fov ?? 60;
    const fogDensity = config.fog ?? 0.5;

    const mobile = isMobile();
    const nFish = mobile ? Math.floor(fishCount / 2) : fishCount;
    const nParticles = mobile ? Math.floor(particleCount / 2) : particleCount;

    // Renderer
    const dpr = mobile ? 1 : Math.min(window.devicePixelRatio, 2);
    const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(new THREE.Color(deepColor), 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const cvs = renderer.domElement;
    cvs.style.position = 'absolute';
    cvs.style.top = '0';
    cvs.style.left = '0';
    cvs.style.width = '100%';
    cvs.style.height = '100%';
    cvs.style.pointerEvents = 'none';
    if (window.getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.appendChild(cvs);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(deepColor);
    scene.fog = new THREE.FogExp2(deepColor, 0.02 + fogDensity * 0.04);

    // Camera
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 100);
    camera.position.set(0, 3, 8);

    // Lights
    const ambient = new THREE.AmbientLight(0x223355, 0.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(new THREE.Color(lightColor), 0.4);
    dirLight.position.set(0, 20, 5);
    scene.add(dirLight);

    // === 1. Ocean Floor ===
    const floorGeo = new THREE.PlaneGeometry(60, 60, 48, 48);
    floorGeo.rotateX(-Math.PI / 2);
    const floorPositions = floorGeo.attributes.position;
    for (let i = 0; i < floorPositions.count; i++) {
        const x = floorPositions.getX(i);
        const z = floorPositions.getZ(i);
        const h = Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.3 + Math.sin(x * 0.8 + z * 0.6) * 0.15;
        floorPositions.setY(i, h);
    }
    floorGeo.computeVertexNormals();
    const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 1.0, metalness: 0.0 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -1;
    scene.add(floor);

    // === 2. God Rays ===
    const rayCount = 6;
    const rayGroup = new THREE.Group();
    const rayUniforms = {
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(...hexToVec3(lightColor)) },
        uIntensity: { value: lightIntensity },
    };

    for (let i = 0; i < rayCount; i++) {
        const geo = new THREE.PlaneGeometry(1.5, 18, 1, 8);
        const phases = new Float32Array(geo.attributes.position.count);
        phases.fill(i * 1.7 + Math.random() * 2);
        geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
        const mat = new THREE.ShaderMaterial({
            vertexShader: godRayVert,
            fragmentShader: godRayFrag,
            uniforms: rayUniforms,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
        });
        const ray = new THREE.Mesh(geo, mat);
        ray.position.set((i - rayCount / 2 + 0.5) * 4 + (Math.random() - 0.5) * 2, 7, -5 + (Math.random() - 0.5) * 10);
        ray.rotation.z = (Math.random() - 0.5) * 0.15;
        rayGroup.add(ray);
    }
    scene.add(rayGroup);

    // === 3. Fish (individual meshes — no InstancedMesh) ===
    const fishGeo = buildFishGeometry();
    const fishMat = new THREE.MeshStandardMaterial({
        color: '#ff8844',
        roughness: 0.6,
        metalness: 0.2,
        side: THREE.DoubleSide,
    });
    const fishGroup = new THREE.Group();

    interface FishState {
        mesh: THREE.Mesh;
        phase: number;
        radius: number;
        centerX: number;
        centerZ: number;
        y: number;
        speed: number;
        scale: number;
    }
    const fishStates: FishState[] = [];

    for (let i = 0; i < nFish; i++) {
        const mesh = new THREE.Mesh(fishGeo, fishMat);
        const scale = 0.15 + Math.random() * 0.15;
        mesh.scale.setScalar(scale);
        fishGroup.add(mesh);
        fishStates.push({
            mesh,
            phase: Math.random() * Math.PI * 2,
            radius: 3 + Math.random() * 5,
            centerX: (Math.random() - 0.5) * 16,
            centerZ: -12 - Math.random() * 8,
            y: 1 + Math.random() * 5,
            speed: 0.2 + Math.random() * 0.3,
            scale,
        });
    }
    scene.add(fishGroup);

    // === 4. Plankton Particles ===
    const planktonGeo = new THREE.BufferGeometry();
    const planktonPos = new Float32Array(nParticles * 3);
    for (let i = 0; i < nParticles; i++) {
        planktonPos[i * 3] = (Math.random() - 0.5) * 30;
        planktonPos[i * 3 + 1] = -1 + Math.random() * 16;
        planktonPos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5;
    }
    planktonGeo.setAttribute('position', new THREE.BufferAttribute(planktonPos, 3));
    const planktonMat = new THREE.PointsMaterial({
        color: 0xaaddff,
        size: 0.06,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const plankton = new THREE.Points(planktonGeo, planktonMat);
    scene.add(plankton);

    // === 5. Post-Processing ===
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const tintColor = hexToVec3(shallowColor);
    const tintPass = new ShaderPass({
        uniforms: {
            tDiffuse: { value: null },
            uTintColor: { value: new THREE.Vector3(...tintColor) },
        },
        vertexShader: underwaterTintShader.vertexShader,
        fragmentShader: underwaterTintShader.fragmentShader,
    });
    composer.addPass(tintPass);
    composer.addPass(new OutputPass());

    // === State ===
    let animationId: number | null = null;
    const clock = new THREE.Clock();
    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);

    // === Animation ===
    function animate() {
        animationId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime() * speedMul;

        // Update god ray uniforms
        rayUniforms.uTime.value = t;

        // Camera: gentle drift + bob
        camera.position.x = Math.sin(t * 0.07) * 2;
        camera.position.y = 3 + Math.sin(t * 0.15) * 0.4;
        camera.position.z = 8 + Math.sin(t * 0.05) * 1.5;

        // Mouse parallax
        mouse.lerp(targetMouse, 0.03);
        camera.lookAt(mouse.x * 2, 2.5 + mouse.y * 0.5, -5);

        // Update fish — simple circular swim
        for (let i = 0; i < nFish; i++) {
            const f = fishStates[i];
            const angle = t * f.speed + f.phase;
            const x = f.centerX + Math.cos(angle) * f.radius;
            const z = f.centerZ + Math.sin(angle) * f.radius;
            const y = f.y + Math.sin(t * 0.4 + f.phase) * 0.3;

            f.mesh.position.set(x, y, z);
            // Face swimming direction (tangent of circle)
            const heading = Math.atan2(-Math.sin(angle), -Math.cos(angle)) + Math.PI;
            f.mesh.rotation.set(0, heading, Math.sin(t * 3 + f.phase) * 0.15);
        }

        // Drift plankton
        const pPos = planktonGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < nParticles; i++) {
            let y = pPos.getY(i) + 0.002 * speedMul;
            if (y > 14) y = -1;
            pPos.setY(i, y);
        }
        pPos.needsUpdate = true;

        composer.render();
    }

    // === Events ===
    function onMouseMove(e: MouseEvent) {
        const rect = cvs.getBoundingClientRect();
        targetMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        targetMouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    }

    function handleResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        composer.setSize(w, h);
    }

    window.addEventListener('mousemove', onMouseMove);
    if (config.responsive !== false) window.addEventListener('resize', handleResize);

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
            window.removeEventListener('mousemove', onMouseMove);
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
        },
    };
}

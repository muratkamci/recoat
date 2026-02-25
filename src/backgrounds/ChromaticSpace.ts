import * as THREE from 'three';
import { EffectComposer, RenderPass, ShaderPass } from 'three/examples/jsm/Addons.js';
import type { ChromaticSpaceConfig, BackgroundInstance } from '../types';
import { resolveContainer } from '../createBackground';

const vertexShader = `
uniform float uTime;
uniform vec2 uMouse;
uniform float uPixelRatio;
uniform float uBreath;
uniform float uScroll;

attribute float aScale;
attribute float aRandomness;

varying float vAlpha;
varying float vDistortion;

vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x2_ = x_ * ns.x + ns.yyyy;
    vec4 y2_ = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x2_) - abs(y2_);
    vec4 b0 = vec4(x2_.xy, y2_.xy);
    vec4 b1 = vec4(x2_.zw, y2_.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
    vec3 pos = position;

    float dist = length(pos);
    float scrollSpread = 1.0 + uScroll * 0.6;
    pos *= scrollSpread;
    pos.y += uScroll * 1.5;

    float breathScale = 1.0 + uBreath * 0.25 * smoothstep(0.0, 4.0, dist);
    pos *= breathScale;

    float noise = snoise(pos * 0.3 + uTime * 0.15);
    float noise2 = snoise(pos * 0.5 + uTime * 0.1 + 100.0);

    pos += normal * noise * 0.5;
    pos.x += sin(uTime * 0.2 + pos.y * 2.0) * 0.15 * aRandomness;
    pos.z += cos(uTime * 0.15 + pos.x * 2.0) * 0.15 * aRandomness;
    pos.y += sin(uTime * 0.1 + dist * 1.5) * 0.08 * aRandomness;

    vec2 mouseOffset = uMouse * 3.0;
    float distToMouse = length(pos.xy - mouseOffset);
    float mouseForce = smoothstep(2.0, 0.0, distToMouse) * 0.8;
    pos.xy += normalize(pos.xy - mouseOffset + 0.001) * mouseForce;
    pos.z += mouseForce * 0.5;

    float glitch = step(0.98, fract(sin(dot(pos.xy, vec2(12.9898, 78.233)) + uTime) * 43758.5453));
    pos.x += glitch * (noise2 * 2.0 - 1.0) * 0.3;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float depth = 1.0 / -mvPosition.z;
    float closeness = smoothstep(0.1, 0.4, depth);
    float sizeBoost = 1.0 + closeness * 0.8;
    gl_PointSize = aScale * uPixelRatio * 2.0 * depth * sizeBoost;
    gl_PointSize = max(gl_PointSize, 1.0);

    float breathGlow = abs(uBreath) * 0.3;
    vAlpha = smoothstep(0.0, 0.3, noise * 0.5 + 0.5) + breathGlow;
    vDistortion = glitch + mouseForce;
}
`;

const fragmentShader = `
varying float vAlpha;
varying float vDistortion;

uniform vec3 uBaseColor;
uniform vec3 uGlitchColor;

void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float alpha = smoothstep(0.5, 0.1, d) * vAlpha * 0.6;
    vec3 color = mix(uBaseColor, uGlitchColor, vDistortion);

    gl_FragColor = vec4(color, alpha);
}
`;

const chromaticAberrationShader = {
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uIntensity;
        varying vec2 vUv;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
            vec2 uv = vUv;

            float scanline = sin(uv.y * 800.0 + uTime * 2.0) * 0.02;

            float glitchTrigger = step(0.995, random(vec2(floor(uTime * 10.0), 0.0)));
            float glitchOffset = glitchTrigger * (random(vec2(uv.y * 10.0, uTime)) - 0.5) * 0.02;
            uv.x += glitchOffset;

            float offset = uIntensity + glitchTrigger * 0.005;
            float r = texture2D(tDiffuse, uv + vec2(offset, 0.0)).r;
            float g = texture2D(tDiffuse, uv).g;
            float b = texture2D(tDiffuse, uv - vec2(offset, 0.0)).b;

            vec3 color = vec3(r, g, b);
            color += scanline;

            float vignette = 1.0 - smoothstep(0.5, 1.4, length(vUv - 0.5) * 1.5);
            color *= vignette;

            gl_FragColor = vec4(color, 1.0);
        }
    `,
};

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

export function ChromaticSpace(config: ChromaticSpaceConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;

    // Config
    const particleCount = config.particleCount ?? 8000;
    const radius = config.radius ?? 5;
    const speedMul = config.speed ?? 1;
    const mouseForceVal = config.mouseForce ?? 0.8;
    const scrollReactive = config.scrollReactive !== false;
    const baseColor = hexToVec3(config.color ?? '#e0e0e0');
    const glitchColor = hexToVec3(config.glitchColor ?? '#ff0040');
    const enablePostProcessing = config.postProcessing !== false;
    const chromaticIntensity = config.chromaticAberration ?? 0.002;

    // Renderer
    const mobile = isMobile();
    const renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(mobile ? 1 : Math.min(window.devicePixelRatio, 2));

    const canvas = renderer.domElement;
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

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 0, 6);

    // Particles
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const randomness = new Float32Array(particleCount);
    const normals = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.pow(Math.random(), 0.5) * radius;

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Normal pointing outward from center
        const len = Math.sqrt(x * x + y * y + z * z) || 1;
        normals[i * 3] = x / len;
        normals[i * 3 + 1] = y / len;
        normals[i * 3 + 2] = z / len;

        scales[i] = Math.random() * 3 + 0.5;
        randomness[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 1));

    const uniforms = {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uBreath: { value: 0 },
        uScroll: { value: 0 },
        uBaseColor: { value: new THREE.Vector3(...baseColor) },
        uGlitchColor: { value: new THREE.Vector3(...glitchColor) },
    };

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Post-processing
    let composer: InstanceType<typeof EffectComposer> | null = null;

    if (enablePostProcessing) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        const chromaticPass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                uTime: { value: 0 },
                uIntensity: { value: chromaticIntensity },
            },
            vertexShader: chromaticAberrationShader.vertexShader,
            fragmentShader: chromaticAberrationShader.fragmentShader,
        });
        composer.addPass(chromaticPass);
    }

    // State
    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);
    let scrollValue = 0;
    let animationId: number | null = null;
    const clock = new THREE.Clock();

    // Event handlers
    function onMouseMove(e: MouseEvent) {
        targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    function onScroll() {
        if (scrollReactive) {
            scrollValue = window.scrollY / window.innerHeight;
        }
    }

    function handleResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (composer) composer.setSize(w, h);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('scroll', onScroll, { passive: true });
    if (config.responsive !== false) {
        window.addEventListener('resize', handleResize);
    }

    // Animation loop
    function animate() {
        animationId = requestAnimationFrame(animate);

        const t = clock.getElapsedTime() * speedMul;

        // Update uniforms
        uniforms.uTime.value = t;
        uniforms.uBreath.value = Math.sin(t * 0.4) * 0.7 + Math.sin(t * 0.7) * 0.3;
        uniforms.uScroll.value = scrollValue;

        // Smooth mouse
        mouse.lerp(targetMouse, 0.05);
        uniforms.uMouse.value.copy(mouse);

        // Rotate
        points.rotation.y = t * 0.02;
        points.rotation.x = Math.sin(t * 0.01) * 0.1;

        // Render
        if (composer) {
            const chromaticPass = composer.passes[1] as ShaderPass;
            if (chromaticPass?.uniforms) {
                chromaticPass.uniforms.uTime.value = t;
            }
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
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
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', handleResize);
            geometry.dispose();
            material.dispose();
            renderer.dispose();
            canvas.remove();
        },
        resize(w: number, h: number) {
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            if (composer) composer.setSize(w, h);
        },
    };
}

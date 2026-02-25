import * as THREE from 'three';
import type { FiberNodesConfig, BackgroundInstance } from '../types';
import { resolveContainer } from '../createBackground';

/* ===== Custom Shader: Metallic 3D Sphere per Point ===== */
const vertexShader = `
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseRadius;
uniform float uMouseForce;
uniform float uElongation;
uniform float uNodeSize;

attribute float aPhase;

varying float vMouseDist;
varying vec3 vWorldPos;

void main() {
    vec3 pos = position;

    // Mouse in world coords (mapped from NDC)
    vec2 mouseWorld = uMouse * vec2(8.0, 5.0);
    float distToMouse = length(pos.xy - mouseWorld);
    float mouseFactor = smoothstep(uMouseRadius, 0.0, distToMouse);

    // Elevate dots near mouse (Z push towards camera)
    pos.z += mouseFactor * uElongation;

    // Subtle wave
    pos.z += sin(pos.x * 1.5 + uTime * 0.5 + aPhase) * 0.05;
    pos.z += cos(pos.y * 1.5 + uTime * 0.3) * 0.05;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size: base + mouse boost + depth
    float baseSize = 18.0 * uNodeSize;
    float mouseBoost = mouseFactor * 28.0;
    float depthScale = 1.0 / -mvPosition.z;
    gl_PointSize = (baseSize + mouseBoost) * depthScale;
    gl_PointSize = max(gl_PointSize, 2.0);

    vMouseDist = mouseFactor;
    vWorldPos = pos;
}
`;

const fragmentShader = `
uniform vec3 uColor;
uniform vec3 uHighlightColor;
uniform vec3 uHoverColor;
uniform float uMetallic;
uniform float uTime;

varying float vMouseDist;
varying vec3 vWorldPos;

void main() {
    // Circular point
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    // 3D sphere normal from point coord
    float z = sqrt(max(0.0, 0.25 - d * d));
    vec3 normal = normalize(vec3(uv.x, -uv.y, z));

    // Light from upper-right-front
    vec3 lightDir = normalize(vec3(0.4, 0.5, 0.8));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);

    // Diffuse
    float diff = max(dot(normal, lightDir), 0.0);

    // Specular (Blinn-Phong, metallic sharpness)
    float specPow = 16.0 + uMetallic * 64.0;
    float spec = pow(max(dot(normal, halfDir), 0.0), specPow);

    // Fresnel rim
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

    // Base color: shift towards hover color near mouse
    vec3 baseCol = mix(uColor, uHoverColor, vMouseDist);

    // Compose metallic look
    vec3 diffuseCol = baseCol * (diff * 0.6 + 0.25);
    vec3 specCol = uHighlightColor * spec * (0.5 + uMetallic * 0.5);
    vec3 rimCol = uHighlightColor * fresnel * 0.2 * uMetallic;

    vec3 color = diffuseCol + specCol + rimCol;

    // Slight ambient occlusion at edges
    float ao = smoothstep(0.5, 0.15, d);
    color *= ao;

    // Alpha: solid center, soft edge, brighter near mouse
    float alpha = smoothstep(0.5, 0.3, d) * (0.7 + vMouseDist * 0.3);

    gl_FragColor = vec4(color, alpha);
}
`;

/* ===== Helpers ===== */
function hexToVec3(hex: string): THREE.Vector3 {
    const c = hex.replace('#', '');
    return new THREE.Vector3(
        parseInt(c.substring(0, 2), 16) / 255,
        parseInt(c.substring(2, 4), 16) / 255,
        parseInt(c.substring(4, 6), 16) / 255,
    );
}

function isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 768;
}

/* ===== Main ===== */
export function FiberNodes(config: FiberNodesConfig): BackgroundInstance {
    const container = resolveContainer(config.container);
    const width = config.width ?? container.clientWidth;
    const height = config.height ?? container.clientHeight;

    const nodeCount = config.nodeCount ?? 2000;
    const baseColor = hexToVec3(config.color ?? '#cccccc');
    const highlightColor = hexToVec3(config.highlightColor ?? '#00cc44');
    const bgColor = config.bgColor ?? '#000000';
    const mouseRadiusVal = config.mouseRadius ?? 3;
    const mouseForce = config.mouseForce ?? 1;
    const speedMul = config.speed ?? 1;
    const elongation = config.elongation ?? 1.5;
    const metallic = config.metallic ?? 0.7;
    const nodeSize = config.nodeSize ?? 3;
    const hoverColor = hexToVec3(config.hoverColor ?? '#cc0000');

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

    // Scene & Camera
    const scene = new THREE.Scene();
    const aspect = width / height;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 0, 10);

    // Generate grid of dots
    // Calculate grid dimensions to fill the view
    const viewH = 2 * Math.tan((45 * Math.PI) / 360) * 10; // visible height at z=0
    const viewW = viewH * aspect;
    const cols = Math.ceil(Math.sqrt(nodeCount * aspect));
    const rows = Math.ceil(nodeCount / cols);
    const totalNodes = cols * rows;

    const spacingX = viewW / cols;
    const spacingY = viewH / rows;

    const positions = new Float32Array(totalNodes * 3);
    const phases = new Float32Array(totalNodes);

    let idx = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = (col - (cols - 1) / 2) * spacingX;
            const y = (row - (rows - 1) / 2) * spacingY;
            positions[idx * 3] = x;
            positions[idx * 3 + 1] = y;
            positions[idx * 3 + 2] = 0;
            phases[idx] = Math.random() * Math.PI * 2;
            idx++;
        }
    }

    // Geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const uniforms = {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseRadius: { value: mouseRadiusVal },
        uMouseForce: { value: mouseForce },
        uElongation: { value: elongation },
        uNodeSize: { value: nodeSize },
        uColor: { value: baseColor },
        uHighlightColor: { value: highlightColor },
        uHoverColor: { value: hoverColor },
        uMetallic: { value: metallic },
    };

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // State
    let animationId: number | null = null;
    const clock = new THREE.Clock();
    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);

    function animate() {
        animationId = requestAnimationFrame(animate);

        const t = clock.getElapsedTime() * speedMul;
        uniforms.uTime.value = t;

        // Smooth mouse
        mouse.lerp(targetMouse, 0.08);
        uniforms.uMouse.value.copy(mouse);

        renderer.render(scene, camera);
    }

    // Events
    function onMouseMove(e: MouseEvent) {
        const rect = cvs.getBoundingClientRect();
        targetMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        targetMouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    }

    function onMouseLeave() {
        targetMouse.set(10, 10); // push far away
    }

    function handleResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    window.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);
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
            window.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mouseleave', onMouseLeave);
            window.removeEventListener('resize', handleResize);
            geometry.dispose();
            material.dispose();
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

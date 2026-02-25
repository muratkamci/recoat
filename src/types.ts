export interface BackgroundConfig {
    /** Target container element or CSS selector */
    container: HTMLElement | string;

    /** Background width (defaults to container width) */
    width?: number;

    /** Background height (defaults to container height) */
    height?: number;

    /** Whether to auto-resize on window resize */
    responsive?: boolean;
}

export interface BackgroundInstance {
    /** Start the animation */
    start(): void;

    /** Stop/pause the animation */
    stop(): void;

    /** Clean up and remove the background */
    destroy(): void;

    /** Resize the canvas */
    resize(width: number, height: number): void;
}

export interface BackgroundFactory {
    (config: BackgroundConfig): BackgroundInstance;
}

/** Aurora-specific configuration */
export interface AuroraConfig extends BackgroundConfig {
    /** Array of colors for the aurora layers (CSS color strings). Defaults to green, blue, purple. */
    colors?: string[];

    /** Animation speed multiplier. Defaults to 1.9. */
    speed?: number;

    /** Overall brightness/opacity of the aurora layers. Defaults to 2.4. */
    brightness?: number;

    /** Background color behind the aurora. Defaults to '#0a0a1a'. */
    bgColor?: string;

    /** Wave amplitude multiplier. Defaults to 1.7. */
    amplitude?: number;
}

/** PixelCity configuration */
export interface PixelCityConfig extends BackgroundConfig {
    /** Sky gradient top color. Defaults to '#0a0a2e'. */
    skyTop?: string;

    /** Sky gradient bottom color. Defaults to '#1a1a3e'. */
    skyBottom?: string;

    /** Building silhouette color. Defaults to '#0c0c1a'. */
    buildingColor?: string;

    /** Window light color. Defaults to '#ffcc44'. */
    windowColor?: string;

    /** Moon/sun color. Defaults to '#eeeedd'. */
    moonColor?: string;

    /** Star count. Defaults to 100. */
    stars?: number;

    /** Scroll speed multiplier. Defaults to 1. */
    speed?: number;

    /** Number of parallax layers. Defaults to 3. */
    layers?: number;

    /** Show moon. Defaults to true. */
    showMoon?: boolean;
}

/** MagneticSand configuration */
export interface MagneticSandConfig extends BackgroundConfig {
    /** Number of particles. Defaults to 5000. */
    particleCount?: number;

    /** Particle color (CSS hex). Defaults to '#5a828c'. */
    color?: string;

    /** Magnetic field line color when aligned (CSS hex). Defaults to '#e1ff00'. */
    fieldColor?: string;

    /** Background color. Defaults to '#050508'. */
    bgColor?: string;

    /** Magnetic force strength. Defaults to 1. */
    force?: number;

    /** Mouse magnet radius in pixels. Defaults to 200. */
    mouseRadius?: number;

    /** Particle drift speed. Defaults to 1. */
    speed?: number;

    /** Particle size (0.5 to 3). Defaults to 1. */
    particleSize?: number;

    /** Field line visibility (0 to 1). Defaults to 0.5. */
    fieldStrength?: number;
}

/** VoronoiShatter configuration */
export interface VoronoiShatterConfig extends BackgroundConfig {
    /** Number of cells. Defaults to 40. */
    cellCount?: number;

    /** Cell edge color (CSS hex). Defaults to '#00eeff'. */
    edgeColor?: string;

    /** Cell fill base color (CSS hex). Defaults to '#0a0a1a'. */
    fillColor?: string;

    /** Highlight/shatter accent color (CSS hex). Defaults to '#ff2060'. */
    accentColor?: string;

    /** Cell movement speed. Defaults to 1. */
    speed?: number;

    /** Edge line opacity (0 to 1). Defaults to 0.6. */
    edgeOpacity?: number;

    /** Mouse interaction radius in pixels. Defaults to 150. */
    mouseRadius?: number;

    /** Shatter intensity on mouse hover (0 to 1). Defaults to 0.5. */
    shatterIntensity?: number;
}

/** StaticNoise (old TV) configuration */
export interface StaticNoiseConfig extends BackgroundConfig {
    /** Noise brightness (0 to 1). Defaults to 0.5. */
    brightness?: number;

    /** Noise contrast (0 to 1). Higher = sharper black/white. Defaults to 0.8. */
    contrast?: number;

    /** Tint color (CSS hex). Defaults to null (grayscale). */
    tint?: string;

    /** Scanline intensity (0 to 1). Defaults to 0.75. */
    scanlines?: number;

    /** Horizontal sync glitch frequency (0 to 1). Defaults to 0.18. */
    syncGlitch?: number;

    /** Pixel size (1 = native, higher = chunkier). Defaults to 2. */
    pixelSize?: number;

    /** Vignette darkening at edges (0 to 1). Defaults to 0.85. */
    vignette?: number;

    /** Flicker intensity (0 to 1). Defaults to 0.1. */
    flicker?: number;
}

/** GlitchFog-specific configuration */
export interface GlitchFogConfig extends BackgroundConfig {
    /** Primary fog color (CSS hex). Defaults to '#de0d87'. */
    color?: string;

    /** Secondary fog color (CSS hex). Defaults to '#cc5c00'. */
    colorSecondary?: string;

    /** Glitch accent color (CSS hex). Defaults to '#ff6020'. */
    glitchColor?: string;

    /** Background color. Defaults to '#050510'. */
    bgColor?: string;

    /** Fog animation speed. Defaults to 2.7. */
    speed?: number;

    /** Fog density/opacity (0 to 1). Defaults to 0.8. */
    density?: number;

    /** Glitch frequency (0 = never, 1 = constant). Defaults to 0.41. */
    glitchFrequency?: number;

    /** Glitch intensity (0 to 1). Defaults to 0.7. */
    glitchIntensity?: number;

}

/** AsciiGrid-specific configuration */
export interface AsciiGridConfig extends BackgroundConfig {
    /** Characters to use. Defaults to ' .:-=+*#%@'. */
    charset?: string;

    /** Grid cell size in pixels. Defaults to 16. */
    cellSize?: number;

    /** Base text color (CSS hex). Defaults to '#ffffff'. */
    color?: string;

    /** Background color. Defaults to '#0a0a0a'. */
    bgColor?: string;

    /** Mouse light radius in cells. Defaults to 12. */
    mouseRadius?: number;

    /** Mouse light intensity (0 to 1). Defaults to 0.8. */
    mouseIntensity?: number;

    /** Noise animation speed. Defaults to 1. */
    speed?: number;

    /** Font family. Defaults to monospace. */
    fontFamily?: string;
}

/** Labyrinth configuration (requires three.js) */
export interface LabyrinthConfig extends BackgroundConfig {
    /** Wall wireframe color (CSS hex). Defaults to '#00ffaa'. */
    wallColor?: string;

    /** Second wall color for cycling (CSS hex). Defaults to '#ff00aa'. */
    wallColor2?: string;

    /** Third wall color for cycling (CSS hex). Defaults to '#00aaff'. */
    wallColor3?: string;

    /** Floor line color (CSS hex). Defaults to '#1a3a2a'. */
    floorColor?: string;

    /** Background/fog color (CSS hex). Defaults to '#050510'. */
    bgColor?: string;

    /** Walk speed multiplier. Defaults to 1. */
    speed?: number;

    /** Camera FOV. Defaults to 75. */
    fov?: number;

    /** Fog density (0 to 1). Defaults to 0.5. */
    fog?: number;

    /** Corridor width. Defaults to 3. */
    corridorWidth?: number;

    /** Wall height. Defaults to 4. */
    wallHeight?: number;
}

/** FiberNodes configuration (requires three.js) */
export interface FiberNodesConfig extends BackgroundConfig {
    /** Number of nodes. Defaults to 2000. */
    nodeCount?: number;

    /** Node base color (CSS hex). Defaults to '#cccccc'. */
    color?: string;

    /** Metallic highlight color (CSS hex). Defaults to '#00cc44'. */
    highlightColor?: string;

    /** Connection line color (CSS hex). Defaults to '#334466'. */
    lineColor?: string;

    /** Background color. Defaults to '#000000'. */
    bgColor?: string;

    /** Connection distance threshold. Defaults to 2.5. */
    connectionDistance?: number;

    /** Mouse interaction radius. Defaults to 3. */
    mouseRadius?: number;

    /** Mouse repulsion/attraction strength. Defaults to 1. */
    mouseForce?: number;

    /** Node drift speed. Defaults to 1. */
    speed?: number;

    /** Node elongation on mouse hover (0 to 3). Defaults to 1.5. */
    elongation?: number;

    /** Metallic sheen intensity (0 to 1). Defaults to 0.7. */
    metallic?: number;

    /** Node base size multiplier. Defaults to 3. */
    nodeSize?: number;

    /** Mouse hover color (CSS hex). Defaults to '#cc0000'. */
    hoverColor?: string;
}

/** ImpossibleStairs configuration (requires three.js) */
export interface ImpossibleStairsConfig extends BackgroundConfig {
    /** Wireframe line color (CSS hex). Defaults to '#00ffaa'. */
    color?: string;

    /** Glow/bloom color (CSS hex). Defaults to '#00ffaa'. */
    glowColor?: string;

    /** Background color. Defaults to '#050510'. */
    bgColor?: string;

    /** Camera orbit speed. Defaults to 1. */
    speed?: number;

    /** Line thickness. Defaults to 1.5. */
    lineWidth?: number;

    /** Number of staircase segments. Defaults to 12. */
    segments?: number;

    /** Enable glow/bloom effect. Defaults to true. */
    glow?: boolean;

    /** Camera field of view in degrees. Defaults to 65. */
    fov?: number;
}

/** Underwater-specific configuration */
export interface UnderwaterConfig extends BackgroundConfig {
    /** Deep water color (CSS hex). Defaults to '#041430'. */
    deepColor?: string;

    /** Shallow/top water color (CSS hex). Defaults to '#0a3d6b'. */
    shallowColor?: string;

    /** Light ray color (CSS hex). Defaults to '#1a8fff'. */
    lightColor?: string;

    /** Bubble outline color (CSS hex). Defaults to '#88ccff'. */
    bubbleColor?: string;

    /** Number of fish. Defaults to 8. */
    fishCount?: number;

    /** Number of bubbles. Defaults to 30. */
    bubbleCount?: number;

    /** Animation speed multiplier. Defaults to 1. */
    speed?: number;

    /** Light ray intensity (0 to 1). Defaults to 0.4. */
    lightIntensity?: number;

    /** Number of seaweed strands. Defaults to 12. */
    seaweedCount?: number;
}

/** ChromaticSpace-specific configuration (requires three.js) */
export interface ChromaticSpaceConfig extends BackgroundConfig {
    /** Number of particles. Defaults to 8000. */
    particleCount?: number;

    /** Particle spread radius. Defaults to 5. */
    radius?: number;

    /** Animation speed multiplier. Defaults to 1. */
    speed?: number;

    /** Mouse repulsion strength (0 to 2). Defaults to 0.8. */
    mouseForce?: number;

    /** Enable scroll reactivity. Defaults to true. */
    scrollReactive?: boolean;

    /** Base particle color (CSS hex). Defaults to '#e0e0e0'. */
    color?: string;

    /** Glitch/distortion accent color (CSS hex). Defaults to '#ff0040'. */
    glitchColor?: string;

    /** Enable post-processing (chromatic aberration + glitch). Defaults to true. */
    postProcessing?: boolean;

    /** Enable chromatic aberration intensity (0 to 0.01). Defaults to 0.002. */
    chromaticAberration?: number;
}

/** DeepOcean configuration (requires three.js) */
export interface DeepOceanConfig extends BackgroundConfig {
    /** Deep water color (CSS hex). Defaults to '#3e5b7e'. */
    deepColor?: string;

    /** Shallow/surface water color (CSS hex). Defaults to '#0a4d7b'. */
    shallowColor?: string;

    /** God ray light color (CSS hex). Defaults to '#4a9eff'. */
    lightColor?: string;

    /** Sand floor color (CSS hex). Defaults to '#1a1510'. */
    floorColor?: string;

    /** Number of fish. Defaults to 12. */
    fishCount?: number;

    /** Number of plankton particles. Defaults to 500. */
    particleCount?: number;

    /** Animation speed multiplier. Defaults to 1. */
    speed?: number;

    /** God ray intensity (0 to 1). Defaults to 0.5. */
    lightIntensity?: number;

    /** Camera FOV. Defaults to 60. */
    fov?: number;

    /** Fog density (0 to 1). Defaults to 0.5. */
    fog?: number;
}

/* ===== Text Animations ===== */

export interface TextAnimationConfig {
    /** Target element or CSS selector. */
    element: HTMLElement | string;

    /** Text to animate. If omitted, uses element's textContent. */
    text?: string;
}

export interface TextAnimationInstance {
    /** Start or replay the animation. */
    play(): void;

    /** Reset to initial state. */
    reset(): void;

    /** Clean up and restore original content. */
    destroy(): void;
}

/** Typewriter configuration */
export interface TypewriterConfig extends TextAnimationConfig {
    /** Typing speed in ms per character. Defaults to 50. */
    speed?: number;

    /** Show blinking cursor. Defaults to true. */
    cursor?: boolean;

    /** Cursor character. Defaults to '|'. */
    cursorChar?: string;

    /** Loop the animation. Defaults to true. */
    loop?: boolean;

    /** Delay before starting in ms. Defaults to 0. */
    startDelay?: number;
}

/** GlitchText configuration */
export interface GlitchTextConfig extends TextAnimationConfig {
    /** Glitch tick speed in ms. Defaults to 50. */
    speed?: number;

    /** Glitch intensity (0 to 1). Defaults to 0.3. */
    intensity?: number;

    /** Characters used for glitch. Defaults to '!@#$%^&*'. */
    glitchChars?: string;

    /** Glitch highlight color (CSS hex). Defaults to '#00ff41'. */
    color?: string;
}

/** ScrambleReveal configuration */
export interface ScrambleRevealConfig extends TextAnimationConfig {
    /** Scramble tick speed in ms. Defaults to 30. */
    speed?: number;

    /** Characters used for scramble. Defaults to 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'. */
    scrambleChars?: string;

    /** Stagger delay between characters in ms. Defaults to 40. */
    stagger?: number;

    /** Scramble iterations per character before revealing. Defaults to 8. */
    iterations?: number;
}

/** ChromaticText configuration */
export interface ChromaticTextConfig extends TextAnimationConfig {
    /** Glitch tick speed in ms. Defaults to 60. */
    speed?: number;

    /** Chromatic spread in pixels. Defaults to 4. */
    intensity?: number;

    /** Blur amount (0 to 1). Defaults to 0.5. */
    blur?: number;

    /** Glitch burst duration in ms. Defaults to 600. */
    burstDuration?: number;

    /** Normal pause duration in ms. Defaults to 1500. */
    pauseDuration?: number;
}

/** GradientText configuration */
export interface GradientTextConfig extends TextAnimationConfig {
    /** Gradient colors array. Defaults to ['#f72585', '#7209b7', '#4361ee', '#4cc9f0', '#f72585']. */
    colors?: string[];

    /** Animation speed multiplier. Defaults to 1. */
    speed?: number;

    /** Gradient angle in degrees. Defaults to 90. */
    angle?: number;
}

/** NeonPulse configuration */
export interface NeonPulseConfig extends TextAnimationConfig {
    /** Neon glow color (CSS hex). Defaults to '#00d4ff'. */
    color?: string;

    /** Glow radius in pixels. Defaults to 20. */
    glowRadius?: number;

    /** Pulse speed multiplier. Defaults to 1. */
    speed?: number;

    /** Flicker intensity (0 to 1). Defaults to 0.4. */
    flicker?: number;

    /** Minimum brightness during dim phase (0 to 1). Defaults to 0.3. */
    minBrightness?: number;
}

/** WavyBounce configuration */
export interface WavyBounceConfig extends TextAnimationConfig {
    /** Wave amplitude in pixels. Defaults to 12. */
    amplitude?: number;

    /** Wave speed multiplier. Defaults to 1. */
    speed?: number;

    /** Phase offset between characters in radians. Defaults to 0.3. */
    stagger?: number;

    /** Text color (CSS hex). Defaults to '#ffffff'. */
    color?: string;
}

/** MatrixRain configuration */
export interface MatrixRainConfig extends TextAnimationConfig {
    /** Rain character color (CSS hex). Defaults to '#00ff41'. */
    color?: string;

    /** Rain speed in ms per tick. Defaults to 60. */
    speed?: number;

    /** Number of rain columns. Defaults to 0 (auto, based on text length). */
    columns?: number;

    /** Time in ms before text settles. Defaults to 3000. */
    settleDuration?: number;

    /** Pause after settling before restarting in ms. Defaults to 2000. */
    pauseDuration?: number;
}

/** GravityDrop configuration */
export interface GravityDropConfig extends TextAnimationConfig {
    /** Gravity strength. Defaults to 1. */
    gravity?: number;

    /** Bounce elasticity (0 to 1). Defaults to 0.5. */
    bounce?: number;

    /** Stagger delay between characters in ms. Defaults to 80. */
    stagger?: number;

    /** Hold duration after all settled in ms. Defaults to 1500. */
    holdDuration?: number;

    /** Text color (CSS hex). Defaults to '#ffffff'. */
    color?: string;
}

/** InkBleed configuration */
export interface InkBleedConfig extends TextAnimationConfig {
    /** Ink color (CSS hex). Defaults to '#ffffff'. */
    color?: string;

    /** Spread speed multiplier. Defaults to 1. */
    speed?: number;

    /** Stagger delay between characters in ms. Defaults to 120. */
    stagger?: number;

    /** Maximum spread radius multiplier. Defaults to 1. */
    spread?: number;

    /** Hold duration after fully revealed in ms. Defaults to 2000. */
    holdDuration?: number;
}

/** MagneticAssemble configuration */
export interface MagneticAssembleConfig extends TextAnimationConfig {
    /** Magnetic pull strength. Defaults to 1. */
    force?: number;

    /** Scatter radius in pixels. Defaults to 300. */
    scatterRadius?: number;

    /** Hold duration after assembled in ms. Defaults to 1500. */
    holdDuration?: number;

    /** Text color (CSS hex). Defaults to '#ffffff'. */
    color?: string;

    /** Damping factor for oscillation (0 to 1). Defaults to 0.15. */
    damping?: number;
}

/** EchoTrail configuration */
export interface EchoTrailConfig extends TextAnimationConfig {
    /** Number of echo copies. Defaults to 5. */
    echoes?: number;

    /** Animation speed multiplier. Defaults to 1. */
    speed?: number;

    /** Trail spacing in pixels between echoes. Defaults to 8. */
    spacing?: number;

    /** Primary text color (CSS hex). Defaults to '#00d4ff'. */
    color?: string;

    /** Echo trail color (CSS hex). Defaults to primary color if omitted. */
    trailColor?: string;
}

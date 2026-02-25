# recoat

Animated backgrounds and text effects for the web. Zero dependencies.

- **13 Backgrounds** — Canvas-based (zero deps) + Three.js-powered (optional peer dep)
- **12 Text Animations** — DOM-based text effects, no canvas needed
- **TypeScript** — Full type definitions included
- **Tree-shakeable** — ESM + CJS, import only what you use

## Install

```bash
npm install recoat
```

## Backgrounds

### Canvas (zero dependencies)

```js
import { Aurora } from 'recoat';

const bg = Aurora({ container: '#my-element' });
bg.start();
```

Available: `Aurora`, `AsciiGrid`, `GlitchFog`, `StaticNoise`, `VoronoiShatter`, `MagneticSand`, `PixelCity`, `Underwater`

### Three.js (requires `three` as peer dependency)

```js
import { Labyrinth } from 'recoat/three';

const bg = Labyrinth({ container: '#my-element' });
bg.start();
```

Available: `Labyrinth`, `ChromaticSpace`, `ImpossibleStairs`, `FiberNodes`, `DeepOcean`

### Background API

Every background returns the same interface:

```ts
interface BackgroundInstance {
    start(): void;
    stop(): void;
    destroy(): void;
    resize(width: number, height: number): void;
}
```

### Background Config

All backgrounds accept a config object:

```ts
Aurora({
    container: '#hero',       // required — element or CSS selector
    width: 1920,              // optional — defaults to container width
    height: 1080,             // optional — defaults to container height
    responsive: true,         // optional — auto-resize on window resize
    // ...effect-specific options (colors, speed, intensity, etc.)
});
```

## Text Animations

```js
import { GlitchText } from 'recoat/text';

const anim = GlitchText({
    element: '#my-heading',
    text: 'Hello World',
});
anim.play();
```

Available: `Typewriter`, `GlitchText`, `ScrambleReveal`, `ChromaticText`, `GradientText`, `NeonPulse`, `WavyBounce`, `MatrixRain`, `GravityDrop`, `InkBleed`, `MagneticAssemble`, `EchoTrail`

### Text Animation API

Every text animation returns:

```ts
interface TextAnimationInstance {
    play(): void;
    reset(): void;
    destroy(): void;
}
```

## Entry Points

| Import from | Contents | Dependencies |
|---|---|---|
| `recoat` | 8 canvas backgrounds | None |
| `recoat/three` | 5 Three.js backgrounds | `three` (peer) |
| `recoat/text` | 12 text animations | None |

## Usage with Frameworks

### React

```jsx
import { useEffect, useRef } from 'react';
import { Aurora } from 'recoat';

function Hero() {
    const ref = useRef(null);

    useEffect(() => {
        if (!ref.current) return;
        const bg = Aurora({ container: ref.current });
        bg.start();
        return () => bg.destroy();
    }, []);

    return <div ref={ref} style={{ width: '100%', height: '100vh' }} />;
}
```

### Vue

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Aurora } from 'recoat';

const el = ref(null);
let bg;

onMounted(() => {
    bg = Aurora({ container: el.value });
    bg.start();
});

onUnmounted(() => bg?.destroy());
</script>

<template>
    <div ref="el" style="width: 100%; height: 100vh" />
</template>
```

### CDN / Script Tag

```html
<div id="bg" style="width: 100%; height: 100vh"></div>

<script type="module">
    import { Aurora } from 'https://unpkg.com/recoat/dist/index.mjs';

    Aurora({ container: '#bg' }).start();
</script>
```

## License

MIT

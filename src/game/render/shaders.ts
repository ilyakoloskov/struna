// Шейдеры дорожки. Все объекты лежат в плоскости дорожки (XZ), линия удара — z = 0.
// Дальний край растворяется в фоне (uLength — длина дорожки).

/** Общий кусок: затухание к дальнему краю */
const FADE = /* glsl */ `
  uniform float uLength;
  float laneFade(float z) {
    return smoothstep(-uLength, -uLength * 0.55, z);
  }
`

// --- Полотно дорожки: фон, линии струн, края ---

export const laneVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const laneFragment = /* glsl */ `
  ${FADE}
  uniform vec3 uBackground;
  uniform vec3 uColors[7];
  uniform float uStringCount;
  uniform float uSpacing;
  uniform float uHalfWidth;
  varying vec3 vWorld;

  // Линия толщиной width мировых единиц со сглаживанием по экрану
  float line(float distance, float width) {
    float aa = fwidth(distance);
    return 1.0 - smoothstep(width - aa, width + aa, distance);
  }

  void main() {
    float x = vWorld.x;
    vec3 color = uBackground;
    float alpha = 0.92;

    for (int i = 0; i < 7; i++) {
      if (float(i) >= uStringCount) break;
      float sx = (float(i) - (uStringCount - 1.0) * 0.5) * uSpacing;
      color += uColors[i] * line(abs(x - sx), 0.012) * 0.45;
    }

    // Края дорожки
    float edge = line(abs(abs(x) - uHalfWidth), 0.012);
    color += vec3(0.16) * edge;

    // Мягкое свечение по краям (как box-shadow на макете)
    float rim = smoothstep(uHalfWidth - 0.9, uHalfWidth, abs(x));
    color += vec3(0.22, 0.17, 0.42) * rim * 0.12;

    gl_FragColor = vec4(color, alpha * laneFade(vWorld.z));
  }
`

// --- Инстансы: доли, хвосты, ноты, кольца. Плоский квадрат 1×1 в XY → в плоскость XZ ---

const INSTANCE_VERTEX_HEAD = /* glsl */ `
  attribute vec3 aOffset;   // центр (x, y, z)
  attribute vec2 aSize;     // ширина по x, длина по z
  varying vec2 vUv;
  varying float vZ;
  vec3 placeOnLane() {
    return vec3(aOffset.x + position.x * aSize.x, aOffset.y, aOffset.z - position.y * aSize.y);
  }
`

export const beatVertex = /* glsl */ `
  ${INSTANCE_VERTEX_HEAD}
  attribute float aStrength;
  varying float vStrength;
  void main() {
    vec3 p = placeOnLane();
    vUv = uv;
    vZ = p.z;
    vStrength = aStrength;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`

export const beatFragment = /* glsl */ `
  ${FADE}
  varying vec2 vUv;
  varying float vZ;
  varying float vStrength;
  void main() {
    gl_FragColor = vec4(vec3(1.0), vStrength * laneFade(vZ));
  }
`

export const tailVertex = /* glsl */ `
  ${INSTANCE_VERTEX_HEAD}
  attribute vec3 aColor;
  varying vec3 vColor;
  varying vec2 vSizeWorld;
  void main() {
    vec3 p = placeOnLane();
    vUv = uv;
    vZ = p.z;
    vColor = aColor;
    vSizeWorld = aSize;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`

export const tailFragment = /* glsl */ `
  ${FADE}
  varying vec2 vUv;
  varying float vZ;
  varying vec3 vColor;
  varying vec2 vSizeWorld;
  void main() {
    // Скруглённые концы: расстояние до осевого отрезка
    vec2 p = (vUv - 0.5) * vSizeWorld;
    float r = vSizeWorld.x * 0.5;
    float d = length(vec2(p.x, max(abs(p.y) - (vSizeWorld.y * 0.5 - r), 0.0))) - r;
    float aa = fwidth(d);
    float shape = 1.0 - smoothstep(-aa, aa, d);
    gl_FragColor = vec4(vColor * 1.1, 0.55 * shape * laneFade(vZ));
  }
`

// Нота стоит на дорожке, наклонённая к камере (uUp): нижняя кромка — момент ноты,
// плашка поднимается вверх, а не лежит плашмя — так её лицевая сторона и надписи видны крупно.
const STANDING_HEAD = /* glsl */ `
  uniform vec3 uUp;
  vec3 standUp(vec3 base, vec2 size, float lift) {
    return base + vec3(position.x * size.x, 0.0, 0.0) + uUp * ((position.y + 0.5) * size.y + lift);
  }
`

export const noteVertex = /* glsl */ `
  ${INSTANCE_VERTEX_HEAD}
  ${STANDING_HEAD}
  attribute vec3 aColor;
  attribute float aShape;  // 0 — плашка, 1 — ромб (флажолет), 2 — глушёная (×)
  attribute float aMute;   // 1 — палм-мьют: тёмная полоса по низу
  varying vec3 vColor;
  varying vec2 vSizeWorld;
  varying float vShape;
  varying float vMute;
  void main() {
    vec3 p = standUp(aOffset, aSize, 0.0);
    vUv = uv;
    vZ = aOffset.z;
    vColor = aColor;
    vSizeWorld = aSize;
    vShape = aShape;
    vMute = aMute;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`

export const noteFragment = /* glsl */ `
  ${FADE}
  varying vec2 vUv;
  varying float vZ;
  varying vec3 vColor;
  varying vec2 vSizeWorld;
  varying float vShape;
  varying float vMute;

  float roundBox(vec2 p, vec2 halfSize, float r) {
    vec2 q = abs(p) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * vSizeWorld;
    vec2 halfSize = vSizeWorld * 0.5;
    float d;
    if (vShape > 0.5 && vShape < 1.5) {
      // Ромб: |x|/a + |y|/b = 1, приближённое расстояние
      vec2 q = abs(p) / halfSize;
      d = (q.x + q.y - 1.0) * min(halfSize.x, halfSize.y) * 0.7;
    } else {
      float radius = min(halfSize.x, halfSize.y) * 0.45;
      d = roundBox(p, halfSize, radius);
    }
    float aa = fwidth(d);
    float body = 1.0 - smoothstep(-aa, aa, d);
    // Светлая обводка, как на макете
    float border = body * smoothstep(-0.035 - aa, -0.035 + aa, d);

    vec3 color = vColor * 1.35;                          // ярче порога bloom — светится
    // Глушёная нота — тёмная плашка с цветной обводкой
    if (vShape > 1.5) color = vColor * 0.25;
    // Лёгкий градиент сверху вниз — объём
    color *= 0.85 + 0.3 * vUv.y;
    // Палм-мьют: тёмная полоса по нижней кромке
    float stripe = vMute * (1.0 - smoothstep(0.2 - 0.02, 0.2 + 0.02, vUv.y));
    color = mix(color, vec3(0.04), stripe * 0.85);
    color = mix(color, vec3(1.0) * 1.2, border * 0.75);  // обводка
    gl_FragColor = vec4(color, body * laneFade(vZ));
  }
`

// Силуэт плашки для буфера глубины прохода надписей (цвет не пишется)
export const occluderFragment = /* glsl */ `
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(0.0);
  }
`

// --- Надписи: номера ладов и знаки приёмов. Рисуются отдельным проходом после bloom,
// поэтому белые и чёткие: свечение их не размывает. ---

export const labelVertex = /* glsl */ `
  ${INSTANCE_VERTEX_HEAD}
  ${STANDING_HEAD}
  attribute float aLift;   // подъём низа надписи над дорожкой (вдоль uUp)
  attribute vec4 aGlyph;   // UV-прямоугольник глифа в атласе
  attribute float aAlpha;
  varying vec4 vGlyph;
  varying float vAlpha;
  void main() {
    vec3 p = standUp(aOffset, aSize, aLift);
    vUv = uv;
    vZ = aOffset.z;
    vGlyph = aGlyph;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`

export const labelFragment = /* glsl */ `
  ${FADE}
  uniform sampler2D uGlyphs;
  varying vec2 vUv;
  varying float vZ;
  varying vec4 vGlyph;
  varying float vAlpha;
  void main() {
    vec4 texel = texture2D(uGlyphs, mix(vGlyph.xy, vGlyph.zw, vUv));
    // Атлас: зелёный — сам глиф, альфа — глиф с обводкой
    vec3 color = mix(vec3(0.03, 0.03, 0.06), vec3(1.0), texel.g);
    float alpha = texel.a * vAlpha * laneFade(vZ);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`

export const ringVertex = /* glsl */ `
  ${INSTANCE_VERTEX_HEAD}
  attribute vec3 aColor;
  attribute float aActive;
  varying vec3 vColor;
  varying float vActive;
  void main() {
    vec3 p = placeOnLane();
    vUv = uv;
    vZ = p.z;
    vColor = aColor;
    vActive = aActive;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`

export const ringFragment = /* glsl */ `
  uniform float uPulse;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vActive;
  void main() {
    float r = length(vUv - 0.5) * 2.0;   // 0 в центре, 1 на краю квадрата
    float aa = fwidth(r);
    float ringShape = smoothstep(0.80 - aa, 0.80 + aa, r) * (1.0 - smoothstep(0.92 - aa, 0.92 + aa, r));
    float disc = 1.0 - smoothstep(0.92 - aa, 0.92 + aa, r);
    // Нота на линии — кольцо заливается и вспыхивает
    vec3 color = vColor * (1.0 + vActive * 1.6);
    float alpha = ringShape * (0.9 + uPulse * 0.1) + disc * (0.1 + vActive * 0.9);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`

export const hitLineFragment = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float glow = 1.0 - abs(vUv.y - 0.5) * 2.0;
    gl_FragColor = vec4(vec3(1.4), glow * glow);
  }
`

export const simpleVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// --- Частицы попадания: квадраты, развёрнутые к камере, аддитивное смешивание ---

export const particleVertex = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec2 aSize;   // размер, яркость
  attribute vec3 aColor;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 p = aOffset + (right * position.x + up * position.y) * aSize.x;
    vUv = uv;
    vColor = aColor;
    vAlpha = aSize.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`

export const particleFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float dot = 1.0 - smoothstep(0.25, 1.0, r);
    // Белая сердцевина и цветной ореол, ярче порога bloom
    vec3 color = mix(vColor, vec3(1.0), 1.0 - smoothstep(0.0, 0.45, r)) * 2.2;
    gl_FragColor = vec4(color * dot * vAlpha, dot * vAlpha);
  }
`

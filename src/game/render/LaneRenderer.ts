import {
  Color,
  DynamicDrawUsage,
  HalfFloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Texture,
} from 'three'
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing'
import type { Beat, FrettedNote } from '@/domain/tracks/types'
import type { GameClock } from '../clock'
import { ATLAS_MAX, DIGIT_UVS } from '../lane/digitAtlas'
import {
  createLayout,
  laneSpeed,
  laneWidth,
  stringX,
  timeToZ,
  type LaneLayout,
} from '../lane/geometry'
import { forEachVisible, maxDuration, ringActivity } from '../lane/visibleNotes'
import { createDigitTexture } from './digitTexture'
import * as glsl from './shaders'

// Рендер игровой дорожки. Цикл кадра не создаёт объектов: видимые ноты пишутся
// в заранее выделенные буферы инстансов (это и есть пул), меняется только instanceCount.

const NOTE_CAPACITY = 512
const TAIL_CAPACITY = 256
const BEAT_CAPACITY = 96

/** Камера под макет: смещение от точки взгляда на дорожке (z = target) */
const CAMERA = { fov: 32, aspect: 1.6, height: 12, distance: 21.25, target: -7 }

/** Размер плашки ноты в долях расстояния между струнами (76×42 при 96 px на макете) */
const NOTE_WIDTH = 0.8
const NOTE_DEPTH = 0.44
const TAIL_WIDTH = 0.19
/** Сколько секунд плашка видна после линии удара */
const NOTE_PAST = 0.06
const RING_SIZE = 0.68

export interface RendererOptions {
  stringCount: number
  /** Цвета струн от самой низкой, CSS-цвета */
  stringColors: readonly string[]
  background: string
  reducedMotion: boolean
  lookahead?: number
}

export interface FrameStats {
  fps: number
  /** Среднее время кадра, мс */
  frameMs: number
  /** Худший кадр за окно, мс */
  worstMs: number
}

interface InstancedLayer {
  mesh: Mesh
  geometry: InstancedBufferGeometry
  attributes: Record<string, InstancedBufferAttribute>
}

export class LaneRenderer {
  private readonly renderer: WebGLRenderer
  private readonly composer: EffectComposer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(32, 1, 0.1, 100)
  private readonly layout: LaneLayout
  private readonly colors: Color[]
  private readonly resizeObserver: ResizeObserver
  private readonly disposables: { dispose(): void }[] = []

  private notes: readonly FrettedNote[] = []
  private longestNote = 0
  private beats: readonly Beat[] = []
  private clock: GameClock | null = null

  private notesLayer!: InstancedLayer
  private tailsLayer!: InstancedLayer
  private beatsLayer!: InstancedLayer
  private ringsLayer!: InstancedLayer
  private ringMaterial!: ShaderMaterial
  private noteMaterial!: ShaderMaterial
  private readonly ringActivity: Float32Array

  // Статистика кадров без аллокаций
  private readonly frameTimes = new Float32Array(120)
  private frameIndex = 0
  private lastFrame = 0

  private readonly projected = new Vector3()

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: RendererOptions,
    private readonly onLayout?: (labelX: number[], hitLineY: number) => void,
  ) {
    this.layout = createLayout(options.stringCount, options.lookahead)
    this.colors = options.stringColors.map((c) => new Color(c))
    this.ringActivity = new Float32Array(options.stringCount)

    this.renderer = new WebGLRenderer({
      canvas,
      powerPreference: 'high-performance',
      antialias: false,
      stencil: false,
      depth: false,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    // Цвет очистки three переводит в sRGB, а postprocessing кодирует кадр в sRGB ещё раз —
    // поэтому заранее «линеаризуем» его второй раз, иначе фон получается серым
    this.renderer.setClearColor(new Color(options.background).convertSRGBToLinear(), 1)

    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: HalfFloatType,
      multisampling: 4,
    })
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    const bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: 0.6,
      luminanceSmoothing: 0.25,
      intensity: options.reducedMotion ? 0.7 : 1.15,
      radius: 0.7,
    })
    this.composer.addPass(new EffectPass(this.camera, bloom))

    this.buildStatic()
    this.positionCamera()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas.parentElement ?? canvas)
    this.resize()
  }

  /** Загружает атлас цифр — до этого номера ладов не видны */
  async init(): Promise<void> {
    const digits = await createDigitTexture()
    this.disposables.push(digits)
    this.noteMaterial.uniforms.uDigits!.value = digits
  }

  setNotes(notes: readonly FrettedNote[]): void {
    // Неиграбельные ноты (вне строя) на дорожку не попадают
    this.notes = notes.filter((n) => n.stringIndex >= 0 && n.stringIndex < this.layout.stringCount)
    this.longestNote = maxDuration(this.notes)
  }

  setBeats(beats: readonly Beat[]): void {
    this.beats = beats
  }

  start(clock: GameClock): void {
    this.clock = clock
    this.lastFrame = performance.now()
    this.renderer.setAnimationLoop(() => this.frame())
  }

  stop(): void {
    this.renderer.setAnimationLoop(null)
  }

  stats(): FrameStats {
    let sum = 0
    let worst = 0
    let count = 0
    for (const ms of this.frameTimes) {
      if (ms <= 0) continue
      sum += ms
      worst = Math.max(worst, ms)
      count++
    }
    const avg = count ? sum / count : 0
    return { fps: avg ? 1000 / avg : 0, frameMs: avg, worstMs: worst }
  }

  dispose(): void {
    this.stop()
    this.resizeObserver.disconnect()
    for (const d of this.disposables) d.dispose()
    this.composer.dispose()
    this.renderer.dispose()
  }

  // --- Кадр ---

  private frame() {
    const now = performance.now()
    this.frameTimes[this.frameIndex] = now - this.lastFrame
    this.frameIndex = (this.frameIndex + 1) % this.frameTimes.length
    this.lastFrame = now

    const songTime = this.clock?.now() ?? 0
    this.updateNotes(songTime)
    this.updateBeats(songTime)
    if (!this.options.reducedMotion) {
      this.ringMaterial.uniforms.uPulse!.value = 0.5 + 0.5 * Math.sin(now / 260)
    }
    this.composer.render()
  }

  // Состояние текущего кадра — в полях, чтобы обработчик ноты не был замыканием
  private frameTime = 0
  private noteCount = 0
  private tailCount = 0

  private updateNotes(songTime: number) {
    const layout = this.layout
    this.frameTime = songTime
    this.noteCount = 0
    this.tailCount = 0
    this.ringActivity.fill(0)

    forEachVisible(
      this.notes,
      songTime - layout.behind,
      songTime + layout.lookahead,
      this.longestNote,
      this.visitNote,
    )

    this.notesLayer.geometry.instanceCount = this.noteCount
    this.tailsLayer.geometry.instanceCount = this.tailCount
    markUpdated(this.notesLayer)
    markUpdated(this.tailsLayer)

    const active = this.ringsLayer.attributes.aActive!
    ;(active.array as Float32Array).set(this.ringActivity)
    active.needsUpdate = true
  }

  /** Обработчик видимой ноты — стрелочная функция-поле, создаётся один раз */
  private readonly visitNote = (note: FrettedNote) => {
    const layout = this.layout
    const songTime = this.frameTime
    const speed = laneSpeed(layout)
    const x = stringX(note.stringIndex, layout)
    const color = this.colors[note.stringIndex]!
    const z = timeToZ(note.time, songTime, layout)

    const activity = ringActivity(songTime, note)
    if (activity > this.ringActivity[note.stringIndex]!) {
      this.ringActivity[note.stringIndex] = activity
    }

    // Хвост — только у длинных нот: от ноты до её конца, но не дальше линии удара
    if (note.duration > 0.3 && this.tailCount < TAIL_CAPACITY) {
      const start = Math.max(note.time, songTime)
      const end = note.time + note.duration
      if (end > start) {
        const length = (end - start) * speed
        const t = this.tailsLayer.attributes
        const i = this.tailCount
        write3(t.aOffset!, i, x, 0.004, timeToZ(start, songTime, layout) - length / 2)
        write2(t.aSize!, i, TAIL_WIDTH, length)
        write3(t.aColor!, i, color.r, color.g, color.b)
        this.tailCount++
      }
    }

    // Сама нота исчезает сразу за линией удара — прошедшие ноты отвлекают
    if (z <= NOTE_PAST * speed && this.noteCount < NOTE_CAPACITY) {
      const a = this.notesLayer.attributes
      const i = this.noteCount
      write3(a.aOffset!, i, x, 0.01, z)
      write3(a.aColor!, i, color.r, color.g, color.b)
      const fret = Math.max(0, Math.min(ATLAS_MAX, note.fret))
      const digit = a.aDigit!.array as Float32Array
      for (let k = 0; k < 4; k++) digit[i * 4 + k] = DIGIT_UVS[fret * 4 + k]!
      this.noteCount++
    }
  }

  private updateBeats(songTime: number) {
    const layout = this.layout
    const to = songTime + layout.lookahead
    const offset = this.beatsLayer.attributes.aOffset!.array as Float32Array
    const strength = this.beatsLayer.attributes.aStrength!.array as Float32Array
    const size = this.beatsLayer.attributes.aSize!.array as Float32Array
    let count = 0
    for (const beat of this.beats) {
      if (beat.time < songTime) continue
      if (beat.time > to || count >= BEAT_CAPACITY) break
      offset[count * 3] = 0
      offset[count * 3 + 1] = 0.002
      offset[count * 3 + 2] = timeToZ(beat.time, songTime, layout)
      size[count * 2 + 1] = beat.downbeat ? 0.035 : 0.014
      strength[count] = beat.downbeat ? 0.16 : 0.07
      count++
    }
    this.beatsLayer.geometry.instanceCount = count
    this.beatsLayer.attributes.aOffset!.needsUpdate = true
    this.beatsLayer.attributes.aSize!.needsUpdate = true
    this.beatsLayer.attributes.aStrength!.needsUpdate = true
  }

  // --- Построение сцены ---

  private buildStatic() {
    const layout = this.layout
    const width = laneWidth(layout)
    const speed = laneSpeed(layout)
    const lengthUniform = { value: layout.length }
    const colorUniform = Array.from({ length: 7 }, (_, i) => this.colors[i] ?? new Color(0))

    // Полотно дорожки
    const behind = layout.behind * speed + 0.6
    const laneGeometry = new PlaneGeometry(width + 0.04, layout.length + behind)
    laneGeometry.rotateX(-Math.PI / 2)
    laneGeometry.translate(0, 0, -(layout.length - behind) / 2)
    const laneMaterial = new ShaderMaterial({
      vertexShader: glsl.laneVertex,
      fragmentShader: glsl.laneFragment,
      transparent: true,
      depthTest: false,
      uniforms: {
        uLength: lengthUniform,
        uBackground: { value: new Color('#0c0c14') },
        uColors: { value: colorUniform },
        uStringCount: { value: layout.stringCount },
        uSpacing: { value: layout.stringSpacing },
        uHalfWidth: { value: width / 2 },
      },
    })
    this.add(new Mesh(laneGeometry, laneMaterial), 0, laneGeometry, laneMaterial)

    // Доли и такты
    this.beatsLayer = this.instanced(
      BEAT_CAPACITY,
      { aOffset: 3, aSize: 2, aStrength: 1 },
      new ShaderMaterial({
        vertexShader: glsl.beatVertex,
        fragmentShader: glsl.beatFragment,
        transparent: true,
        depthTest: false,
        uniforms: { uLength: lengthUniform },
      }),
      1,
    )
    const beatSize = this.beatsLayer.attributes.aSize!.array as Float32Array
    for (let i = 0; i < BEAT_CAPACITY; i++) beatSize[i * 2] = width

    // Хвосты длинных нот
    this.tailsLayer = this.instanced(
      TAIL_CAPACITY,
      { aOffset: 3, aSize: 2, aColor: 3 },
      new ShaderMaterial({
        vertexShader: glsl.tailVertex,
        fragmentShader: glsl.tailFragment,
        transparent: true,
        depthTest: false,
        uniforms: { uLength: lengthUniform },
      }),
      2,
    )

    // Кольца на линии удара
    this.ringMaterial = new ShaderMaterial({
      vertexShader: glsl.ringVertex,
      fragmentShader: glsl.ringFragment,
      transparent: true,
      depthTest: false,
      uniforms: { uPulse: { value: 0 } },
    })
    this.ringsLayer = this.instanced(
      layout.stringCount,
      { aOffset: 3, aSize: 2, aColor: 3, aActive: 1 },
      this.ringMaterial,
      3,
    )
    const rings = this.ringsLayer.attributes
    for (let i = 0; i < layout.stringCount; i++) {
      ;(rings.aOffset!.array as Float32Array).set([stringX(i, layout), 0.006, 0], i * 3)
      ;(rings.aSize!.array as Float32Array).set([RING_SIZE, RING_SIZE], i * 2)
      const c = this.colors[i]!
      ;(rings.aColor!.array as Float32Array).set([c.r, c.g, c.b], i * 3)
    }
    this.ringsLayer.geometry.instanceCount = layout.stringCount

    // Линия удара
    const hitGeometry = new PlaneGeometry(width + 0.3, 0.06)
    hitGeometry.rotateX(-Math.PI / 2)
    const hitMaterial = new ShaderMaterial({
      vertexShader: glsl.simpleVertex,
      fragmentShader: glsl.hitLineFragment,
      transparent: true,
      depthTest: false,
    })
    const hitLine = new Mesh(hitGeometry, hitMaterial)
    hitLine.position.y = 0.005
    this.add(hitLine, 4, hitGeometry, hitMaterial)

    // Ноты
    this.noteMaterial = new ShaderMaterial({
      vertexShader: glsl.noteVertex,
      fragmentShader: glsl.noteFragment,
      transparent: true,
      depthTest: false,
      uniforms: {
        uLength: lengthUniform,
        uDigits: { value: null as Texture | null },
        uInk: { value: new Color('#0a0a12') },
      },
    })
    this.notesLayer = this.instanced(
      NOTE_CAPACITY,
      { aOffset: 3, aSize: 2, aColor: 3, aDigit: 4 },
      this.noteMaterial,
      5,
    )
    const noteSize = this.notesLayer.attributes.aSize!.array as Float32Array
    for (let i = 0; i < NOTE_CAPACITY; i++) {
      noteSize[i * 2] = NOTE_WIDTH * layout.stringSpacing
      noteSize[i * 2 + 1] = NOTE_DEPTH * layout.stringSpacing
    }
  }

  private instanced(
    capacity: number,
    attributes: Record<string, number>,
    material: ShaderMaterial,
    renderOrder: number,
  ): InstancedLayer {
    const geometry = new InstancedBufferGeometry()
    geometry.copy(new PlaneGeometry(1, 1) as unknown as InstancedBufferGeometry)
    const created: Record<string, InstancedBufferAttribute> = {}
    for (const [name, itemSize] of Object.entries(attributes)) {
      const attribute = new InstancedBufferAttribute(
        new Float32Array(capacity * itemSize),
        itemSize,
      )
      attribute.setUsage(DynamicDrawUsage)
      geometry.setAttribute(name, attribute)
      created[name] = attribute
    }
    geometry.instanceCount = 0
    const mesh = new Mesh(geometry, material)
    this.add(mesh, renderOrder, geometry, material)
    return { mesh, geometry, attributes: created }
  }

  private add(mesh: Mesh, renderOrder: number, geometry: BufferGeometry, material: ShaderMaterial) {
    mesh.renderOrder = renderOrder
    mesh.frustumCulled = false
    this.scene.add(mesh)
    this.disposables.push(geometry, material)
  }

  // --- Камера и размеры ---

  private positionCamera() {
    const aspect = this.camera.aspect || 16 / 9
    // Подобрано численно под пропорции макета при 16:10: линия удара на 83 % высоты,
    // дальний край — на 23 %, ширина 7-струнной дорожки — 42 % экрана.
    // На более узких экранах и для 7 струн камера отъезжает вдоль той же линии взгляда.
    const fit = Math.max(1, CAMERA.aspect / aspect) * Math.sqrt(this.layout.stringCount / 7)
    this.camera.fov = CAMERA.fov
    this.camera.position.set(0, CAMERA.height * fit, CAMERA.target + CAMERA.distance * fit)
    this.camera.lookAt(0, 0, CAMERA.target)
    this.camera.updateProjectionMatrix()
  }

  private resize() {
    const parent = this.canvas.parentElement
    const width = parent?.clientWidth ?? this.canvas.clientWidth
    const height = parent?.clientHeight ?? this.canvas.clientHeight
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.composer.setSize(width, height)
    this.camera.aspect = width / height
    this.positionCamera()
    this.reportLayout(width, height)
  }

  /** Экранные x струн на линии удара — для подписей струн в HUD */
  private reportLayout(width: number, height: number) {
    if (!this.onLayout) return
    const xs: number[] = []
    let hitY = 0
    for (let i = 0; i < this.layout.stringCount; i++) {
      this.projected.set(stringX(i, this.layout), 0, 0).project(this.camera)
      xs.push(((this.projected.x + 1) / 2) * width)
      hitY = ((1 - this.projected.y) / 2) * height
    }
    this.onLayout(xs, hitY)
  }
}

function write3(
  attribute: InstancedBufferAttribute,
  index: number,
  a: number,
  b: number,
  c: number,
) {
  const array = attribute.array as Float32Array
  array[index * 3] = a
  array[index * 3 + 1] = b
  array[index * 3 + 2] = c
}

function write2(attribute: InstancedBufferAttribute, index: number, a: number, b: number) {
  const array = attribute.array as Float32Array
  array[index * 2] = a
  array[index * 2 + 1] = b
}

function markUpdated(layer: InstancedLayer) {
  for (const name in layer.attributes) layer.attributes[name]!.needsUpdate = true
}

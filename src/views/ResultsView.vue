<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import PageContainer from '@/components/layout/PageContainer.vue'
import AccuracyTimeline from '@/components/results/AccuracyTimeline.vue'
import GradeBadge from '@/components/results/GradeBadge.vue'
import ProgressCard from '@/components/results/ProgressCard.vue'
import StringAccuracy from '@/components/results/StringAccuracy.vue'
import { formatClock } from '@/domain/time'
import { formatLoop } from '@/game/loop'
import { hotspots, isPractice, progressPoints, type Hotspot } from '@/game/progress'
import { formatAccuracy, formatScore } from '@/game/score'
import { useResultsStore } from '@/stores/results'

const props = defineProps<{ sessionId: string }>()

const store = useResultsStore()
const router = useRouter()
const result = computed(() => store.get(props.sessionId))
const practice = computed(() => !!result.value && isPractice(result.value))

const previousBest = computed(() =>
  result.value ? store.bestScore(result.value.trackId, result.value.id) : null,
)
const newRecord = computed(
  () =>
    !!result.value &&
    !practice.value &&
    result.value.score > 0 &&
    (previousBest.value ?? -1) < result.value.score,
)

const attempts = computed(() => (result.value ? store.forTrack(result.value.trackId) : []))
const points = computed(() => progressPoints(attempts.value))
const problemSpots = computed(() => hotspots(attempts.value.filter((s) => !s.loop)))

const subtitle = computed(() => {
  const r = result.value
  if (!r) return ''
  const parts = [r.tuningLabel, `темп ${Math.round((r.tempo ?? 1) * 100)} %`]
  if (r.loop) parts.push(`петля ${formatClock(r.loop.start)}–${formatClock(r.loop.end)}`)
  if (practice.value) parts.push('практика — в рекорд не идёт')
  return parts.join(' · ')
})

/** Адрес игры этого трека с параметрами практики */
function playQuery(extra: Record<string, string>) {
  const r = result.value!
  const exercise = r.trackId.startsWith('exercise:')
  if (exercise) {
    const [, key, mode, where] = r.trackId.split(':')
    // Позиция (boxes2 / caged3) или диапазон ладов (5-9)
    const position = /^(boxes|caged)(\d)$/.exec(where ?? '')
    const placement = position ? { sys: position[1], pos: position[2] } : { frets: where }
    return {
      name: 'play',
      params: { trackId: 'exercise' },
      query: { key, mode, ...placement, ...extra },
    }
  }
  return { name: 'play', params: { trackId: r.trackId }, query: extra }
}

const slowerTempo = computed(() => Math.max(50, Math.round((result.value?.tempo ?? 1) * 100) - 25))

function loopSpot(spot: Hotspot) {
  void router.push(playQuery({ loop: formatLoop(spot), tempo: String(slowerTempo.value) }))
}

const breakdown = computed(() => {
  const r = result.value
  if (!r) return []
  const total = r.perfect + r.good + r.miss || 1
  return [
    { key: 'perfect', label: 'Perfect', count: r.perfect, share: r.perfect / total },
    { key: 'good', label: 'Good', count: r.good, share: r.good / total },
    { key: 'miss', label: 'Miss', count: r.miss, share: r.miss / total },
  ]
})
</script>

<template>
  <PageContainer>
    <div v-if="result" class="results">
      <section class="summary">
        <header>
          <h1 class="summary__title">{{ result.trackName }}</h1>
          <p class="summary__meta">{{ subtitle }}</p>
        </header>

        <GradeBadge :grade="result.grade" :stars="result.stars" :new-record="newRecord" />

        <div class="tiles">
          <div class="tile">
            <span class="caps-label">Счёт</span>
            <span class="tile__value">{{ formatScore(result.score) }}</span>
          </div>
          <div class="tile">
            <span class="caps-label">Точность</span>
            <span class="tile__value">{{ formatAccuracy(result.accuracy) }}</span>
          </div>
          <div class="tile">
            <span class="caps-label">Макс. комбо</span>
            <span class="tile__value">{{ result.maxCombo }}</span>
          </div>
        </div>

        <div class="breakdown">
          <div
            class="breakdown__bar"
            role="img"
            :aria-label="breakdown.map((b) => `${b.label} ${b.count}`).join(', ')"
          >
            <span
              v-for="b in breakdown.filter((x) => x.count > 0)"
              :key="b.key"
              :class="`breakdown__part breakdown__part--${b.key}`"
              :style="{ flexGrow: b.share }"
            />
          </div>
          <div class="breakdown__legend">
            <span v-for="b in breakdown" :key="b.key">{{ b.label }} {{ b.count }}</span>
            <span v-if="result.extraNotes" class="breakdown__extra">
              Лишних нот {{ result.extraNotes }}
            </span>
          </div>
        </div>

        <div class="actions">
          <RouterLink
            class="btn btn--primary"
            :to="
              playQuery({
                ...(result.tempo && result.tempo < 1
                  ? { tempo: String(Math.round(result.tempo * 100)) }
                  : {}),
                ...(result.loop ? { loop: formatLoop(result.loop) } : {}),
              })
            "
          >
            Ещё раз
          </RouterLink>
          <RouterLink
            v-if="(result.tempo ?? 1) > 0.5"
            class="btn btn--slow"
            :to="playQuery({ tempo: String(slowerTempo) })"
          >
            Медленнее · {{ slowerTempo }} %
          </RouterLink>
        </div>
      </section>

      <div class="charts">
        <AccuracyTimeline
          :segments="result.timeline"
          :duration="result.duration"
          :hardest="result.hardest"
          @loop="loopSpot({ ...$event, accuracy: 0, attempts: 1 })"
        />
        <StringAccuracy :strings="result.strings" :weakest="result.weakestString" />
        <ProgressCard
          :points="points"
          :hotspots="problemSpots"
          :current-id="result.id"
          @loop="loopSpot"
        />
      </div>
    </div>

    <section v-else-if="store.loaded" class="missing">
      <div class="caps-label">Результаты</div>
      <h1 class="summary__title">Сессия не найдена</h1>
      <p class="summary__meta">Возможно, трек с этой сессией удалён из библиотеки.</p>
      <RouterLink class="btn btn--primary" :to="{ name: 'library' }">В библиотеку</RouterLink>
    </section>
  </PageContainer>
</template>

<style scoped>
.results {
  display: flex;
  gap: 64px;
  min-height: calc(100dvh - var(--header-height) - 80px);
}

.summary {
  width: 420px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.summary__title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 28px;
  color: var(--color-text-strong);
}

.summary__meta {
  margin-top: 4px;
  font-size: 15px;
  color: var(--color-text-muted);
}

.tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border);
  background: var(--color-surface-2);
}

.tile .caps-label {
  font-size: 11px;
}

.tile__value {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 20px;
  color: var(--color-text-strong);
  white-space: nowrap;
}

.breakdown {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.breakdown__bar {
  display: flex;
  gap: 2px;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
}

.breakdown__part--perfect {
  background: var(--grade-perfect);
}

.breakdown__part--good {
  background: var(--grade-good);
}

.breakdown__part--miss {
  background: var(--grade-miss);
}

.breakdown__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-soft);
}

.breakdown__extra {
  color: var(--color-text-muted);
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

.btn {
  flex: 1;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-tile);
  font-size: 15px;
  font-weight: 700;
}

.btn--primary {
  border: 0;
  background: var(--color-text);
  color: var(--color-text-inverse);
  font-weight: 800;
}

.btn--slow {
  border: 1px solid rgba(255, 176, 32, 0.6);
  background: transparent;
  color: var(--grade-good-text);
}

.btn--slow:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.charts {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.missing {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.missing .btn {
  flex: none;
  padding: 0 28px;
  margin-top: 12px;
}

@media (max-width: 1100px) {
  .results {
    flex-direction: column;
  }

  .summary {
    width: 100%;
  }
}
</style>

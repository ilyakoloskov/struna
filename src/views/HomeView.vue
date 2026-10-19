<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import PageContainer from '@/components/layout/PageContainer.vue'

interface QuickLink {
  title: string
  description: string
  to: RouteLocationRaw
  color: string
}

const STRING_COLORS = [7, 6, 5, 4, 3, 2, 1].map((n) => `var(--string-${n})`)

const QUICK_LINKS: QuickLink[] = [
  {
    title: 'Играть',
    description: 'Выбери трек из библиотеки, подключи гитару и лови ноты на дорожке.',
    to: { name: 'library' },
    color: 'var(--string-6)',
  },
  {
    title: 'Тюнер',
    description: 'Настрой 6- или 7-струнную гитару: Standard, Drop D, Drop A или свой строй.',
    to: { name: 'tuner' },
    color: 'var(--string-2)',
  },
  {
    title: 'Теория',
    description: 'Квинтовый круг, ноты на грифе, гаммы и лады с подсветкой под тональность.',
    to: { name: 'theory-circle' },
    color: 'var(--string-7)',
  },
]
</script>

<template>
  <PageContainer>
    <section class="hero">
      <div class="caps-label">Тренажёр для гитариста</div>
      <h1 class="hero__title">Играй на гитаре&nbsp;— ноты летят навстречу</h1>
      <div class="strings" aria-hidden="true">
        <span
          v-for="(color, i) in STRING_COLORS"
          :key="i"
          class="strings__line"
          :style="{ '--line-color': color }"
        />
      </div>
    </section>

    <nav class="cards" aria-label="Быстрый доступ">
      <RouterLink
        v-for="link in QUICK_LINKS"
        :key="link.title"
        :to="link.to"
        class="card"
        :style="{ '--card-color': link.color }"
      >
        <span class="card__dot" aria-hidden="true" />
        <span class="card__title">{{ link.title }}</span>
        <span class="card__description">{{ link.description }}</span>
        <span class="card__arrow" aria-hidden="true">→</span>
      </RouterLink>
    </nav>
  </PageContainer>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 48px 0 56px;
}

.hero__title {
  max-width: 1000px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(36px, 5.2vw, 72px);
  line-height: 1.05;
  color: var(--color-text-strong);
}

.strings {
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-width: 560px;
  margin-top: 12px;
}

.strings__line {
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--line-color), transparent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--line-color) 50%, transparent);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 220px;
  padding: 28px;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow: hidden;
  transition:
    border-color var(--dur-fast) ease,
    box-shadow var(--dur-fast) ease,
    transform var(--dur-fast) var(--ease-out);
}

.card:hover {
  border-color: color-mix(in srgb, var(--card-color) 55%, transparent);
  box-shadow: 0 0 40px color-mix(in srgb, var(--card-color) 18%, transparent);
  transform: translateY(-2px);
}

.card__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--card-color);
  box-shadow:
    0 0 22px color-mix(in srgb, var(--card-color) 85%, transparent),
    0 0 60px color-mix(in srgb, var(--card-color) 35%, transparent);
}

.card__title {
  margin-top: 12px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 28px;
  color: var(--color-text-strong);
}

.card__description {
  color: var(--color-text-muted);
}

.card__arrow {
  margin-top: auto;
  font-size: 22px;
  font-weight: 700;
  color: var(--card-color);
}

@media (prefers-reduced-motion: reduce) {
  .card:hover {
    transform: none;
  }
}
</style>

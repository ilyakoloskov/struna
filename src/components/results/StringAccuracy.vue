<script setup lang="ts">
import type { StringAccuracy } from '@/game/results'

// Точность по струнам: полоса на струну в её цвете, подпись «7 · B» и процент текстом
defineProps<{ strings: readonly StringAccuracy[]; weakest: number | null }>()
</script>

<template>
  <section class="card">
    <header class="card__head">
      <h2 class="card__title">Точность по струнам</h2>
      <span v-if="weakest" class="card__note">Больше всего промахов на {{ weakest }}-й струне</span>
    </header>
    <ul class="rows">
      <li
        v-for="s in strings"
        :key="s.number"
        class="row"
        :style="{ '--string-color': `var(--string-${s.number})` }"
        :title="s.notes ? `${s.notes} нот` : 'нот не было'"
      >
        <span class="row__label">{{ s.number }} · {{ s.name }}</span>
        <span class="row__track">
          <i v-if="s.accuracy !== null" :style="{ width: `${s.accuracy * 100}%` }" />
        </span>
        <span class="row__value">{{
          s.accuracy === null ? '—' : `${Math.round(s.accuracy * 100)} %`
        }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.card__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
}

.card__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-strong);
}

.card__note {
  font-size: 13px;
  font-weight: 600;
  color: #c9b8ff;
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.row {
  display: grid;
  grid-template-columns: 64px 1fr 64px;
  align-items: center;
  gap: 16px;
}

.row__label {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 15px;
  color: var(--string-color);
}

.row__track {
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.row__track i {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: var(--string-color);
  box-shadow: 0 0 10px color-mix(in srgb, var(--string-color) 50%, transparent);
}

.row__value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-soft);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>

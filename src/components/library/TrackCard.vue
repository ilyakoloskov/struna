<script setup lang="ts">
import { formatClock } from '@/domain/time'
import type { LibraryTrack } from '@/stores/library'
import { guitarTrackOf } from '@/stores/library'

// Карточка трека в библиотеке
defineProps<{ track: LibraryTrack; selected: boolean; tuningLabel: string }>()
const emit = defineEmits<{ select: []; remove: [] }>()
</script>

<template>
  <article class="card" :class="{ 'card--selected': selected }">
    <button type="button" class="card__main" @click="emit('select')">
      <span class="card__name">{{ track.song.name }}</span>
      <span class="card__meta">
        {{ tuningLabel }} · {{ formatClock(track.song.duration) }} · {{ track.song.bpm }} bpm
      </span>
      <span class="card__meta">
        {{ guitarTrackOf(track)?.notes.length ?? 0 }} нот гитары · рекорд —
      </span>
    </button>
    <button
      type="button"
      class="card__remove"
      aria-label="Убрать из библиотеки"
      @click="emit('remove')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  transition: border-color var(--dur-fast) ease;
}

.card:hover {
  border-color: var(--color-border-strong);
}

.card--selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 30px rgba(167, 139, 250, 0.12);
}

.card__main {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 16px 44px 16px 18px;
  border: 0;
  background: transparent;
  text-align: left;
}

.card__name {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 16px;
  color: var(--color-text-strong);
}

.card__meta {
  font-size: 13px;
  color: var(--color-text-muted);
}

.card__remove {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: var(--color-text-dim);
}

.card__remove:hover {
  background: var(--color-overlay-hover);
  color: var(--color-text);
}
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { FrameStats } from '@/game/render/LaneRenderer'

// Счётчик кадров для проверки «стабильные 60 fps» (включается ?fps в адресе)
const props = defineProps<{ read: () => FrameStats | null }>()
const stats = ref<FrameStats | null>(null)
let timer = 0

onMounted(() => {
  timer = window.setInterval(() => (stats.value = props.read()), 500)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div v-if="stats" class="fps" :class="{ 'fps--bad': stats.fps < 57 || stats.worstMs > 25 }">
    {{ stats.fps.toFixed(0) }} fps · {{ stats.frameMs.toFixed(1) }} мс · худший
    {{ stats.worstMs.toFixed(1) }} мс
  </div>
</template>

<style scoped>
.fps {
  position: absolute;
  left: 16px;
  top: calc(var(--header-height) + 8px);
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--grade-perfect-text);
  z-index: 20;
}

.fps--bad {
  color: var(--grade-miss);
}
</style>

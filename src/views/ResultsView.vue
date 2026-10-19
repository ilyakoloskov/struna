<script setup lang="ts">
import PageContainer from '@/components/layout/PageContainer.vue'
import PageStub from '@/components/ui/PageStub.vue'

defineProps<{ sessionId: string }>()
</script>

<template>
  <PageContainer>
    <PageStub
      :eyebrow="`Сессия ${sessionId}`"
      title="Результаты"
      description="Оценка, точность, максимальное комбо, точность по ходу трека и по струнам."
      :stage="6"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import PageContainer from '@/components/layout/PageContainer.vue'
import PageStub from '@/components/ui/PageStub.vue'
</script>

<template>
  <PageContainer>
    <PageStub
      eyebrow="Настройки"
      title="Настройки"
      description="Вход звука, строй гитары, калибровка задержки и вид."
      :stage="7"
    />
  </PageContainer>
</template>

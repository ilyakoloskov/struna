<script setup lang="ts">
import PageContainer from '@/components/layout/PageContainer.vue'
import PageStub from '@/components/ui/PageStub.vue'
</script>

<template>
  <PageContainer>
    <PageStub
      eyebrow="Тюнер"
      title="Тюнер"
      description="Выбор звуковой карты, уровень сигнала, определение высоты тона и шкала центов для 6 и 7 струн."
      :stage="2"
    />
  </PageContainer>
</template>

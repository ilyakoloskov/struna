<script setup lang="ts">
import PageContainer from '@/components/layout/PageContainer.vue'
import PageStub from '@/components/ui/PageStub.vue'
</script>

<template>
  <PageContainer>
    <PageStub
      eyebrow="Библиотека"
      title="Треки"
      description="Карточки треков: название, строй, сложность и лучший результат. Загрузка MIDI-файлов."
      :stage="4"
    />
  </PageContainer>
</template>

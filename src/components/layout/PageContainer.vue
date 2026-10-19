<template>
  <div class="page">
    <slot />
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  width: 100%;
  padding: 24px var(--page-gutter) 48px;
}
</style>

<script setup lang="ts">
import { useTopnavOverride } from '@/lib/topnavSlots';
import TopnavIdentity from './TopnavIdentity.vue';

const override = useTopnavOverride();
</script>

<template>
  <Col
    class="shrink-0 bg-metro-bg-light dark:bg-metro-bg-dark
      border-b border-metro-border-light dark:border-metro-border-dark"
  >
    <Col v-show="override" id="topnav-override" />
    <Row
      v-show="!override"
      align="center"
      justify="between"
      class="h-[52px] box-border px-4"
    >
      <Row align="center" :gap="8">
        <TopnavIdentity />
      </Row>
      <Row id="topnav-right" align="center" :gap="18" />
    </Row>
  </Col>
</template>

<script setup lang="ts">

import { useActivity } from '@/lib/useActivity';

const { rows, loading, error, profileVersion } = useActivity();
</script>

<template>
  <Col class="px-4">
    <Col v-if="error" align="center" class="py-10">
      <Text size="md" color="danger">Couldn’t load activity</Text>
    </Col>

    <Col
      v-else-if="loading"
      align="center"
      class="py-10 text-metro-link-light dark:text-metro-link-dark"
    >
      <Spinner :size="28" />
    </Col>

    <Col v-else-if="rows.length === 0" align="center" class="py-10">
      <Text size="md" color="secondary">No transactions yet</Text>
    </Col>

    <Col v-else>
      <TxRow
        v-for="r in rows"
        :key="r.hash"
        :r="r"
        :profile-version="profileVersion"
      />
    </Col>
  </Col>
</template>

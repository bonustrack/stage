<script setup lang="ts">

import { computed } from 'vue';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { basicRoot, nftGrid, LINK_OPEN } from '@stage-labs/views';
import { useNfts } from '@/lib/useNfts';

const palette = useKitPalette();
const { nfts, loading, error } = useNfts();

const node = computed(() =>
  basicRoot(nftGrid({
    cardBg: palette.border,
    items: (nfts.value ?? []).map((n) => ({
      title: n.title,
      collection: n.collection || undefined,
      image: n.image || undefined,
      url: n.openseaUrl || undefined,
    })),
  })));

const actions = {
  [LINK_OPEN]: (payload: Record<string, unknown>): void => {
    const url = payload.url;
    if (typeof url === 'string' && url) window.open(url, '_blank', 'noopener,noreferrer');
  },
};
</script>

<template>
  <Col class="px-4">
    <Col
      v-if="loading"
      align="center"
      class="py-10 text-metro-link-light dark:text-metro-link-dark"
    >
      <Spinner :size="28" />
    </Col>

    <Col v-else-if="error" align="center" class="py-10">
      <Text size="md" color="danger">Failed to load NFTs.</Text>
    </Col>

    <Col v-else-if="!nfts || nfts.length === 0" align="center" class="py-10">
      <Text size="md" color="secondary">There are no NFTs in this wallet.</Text>
    </Col>

    <Col v-else class="pt-1.5 -mx-1.5">
      <ViewHost :node="node" :actions="actions" />
    </Col>
  </Col>
</template>

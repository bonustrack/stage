<script setup lang="ts">

import { useNfts } from '@/lib/useNfts';

const { nfts, loading, error } = useNfts();
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

    <Row v-else class="flex-wrap pt-1.5 -mx-1.5">
      <Box v-for="nft in nfts" :key="`${nft.chainId}:${nft.id}`" class="w-1/2 p-1.5">
        <Pressable
          tag="a"
          :href="nft.openseaUrl || undefined"
          target="_blank"
          rel="noopener noreferrer"
          class="block active:opacity-70"
        >
          <Image
            v-if="nft.image"
            :src="nft.image"
            fit="cover"
            width="100%"
            :radius="12"
            class="aspect-square bg-metro-border-light dark:bg-metro-border-dark"
          />
          <Box
            v-else
            class="w-full aspect-square rounded-xl flex items-center justify-center
              bg-metro-border-light dark:bg-metro-border-dark"
          >
            <Icon name="photo" :size="28" class="text-metro-sub-light dark:text-metro-sub-dark" />
          </Box>
          <Text size="md" weight="semibold" color="link" class="mt-1.5" :truncate="true">
            {{ nft.title }}
          </Text>
          <Text v-if="nft.collection" size="xs" color="secondary" :truncate="true">
            {{ nft.collection }}
          </Text>
        </Pressable>
      </Box>
    </Row>
  </Col>
</template>

<template>
  <div class="search-type">
    <Transition name="fade" mode="out-in">
      <SongList
        v-if="searchResultData.length > 0"
        :data="searchResultData"
        :loading="loading"
        doubleClickAction="add"
        disabledSort
      />
      <n-empty
        v-else-if="!loading"
        :description="`很抱歉，未能找到与 ${keyword} 相关的任何 PigeonCDN 歌曲`"
        style="margin-top: 60px"
        size="large"
      >
        <template #icon>
          <SvgIcon name="SearchOff" />
        </template>
      </n-empty>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { SongType } from "@/types/main";
import { searchPigeonSongs } from "@/api/pigeon";

const props = defineProps<{
  keyword: string;
}>();

const loading = ref<boolean>(true);
const searchResultData = ref<SongType[]>([]);

const getSearchResult = async () => {
  loading.value = true;
  try {
    searchResultData.value = await searchPigeonSongs(props.keyword);
  } catch (error) {
    console.error("❌ PigeonCDN 搜索失败:", error);
    searchResultData.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  getSearchResult();
});
</script>

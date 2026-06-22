<template>
  <div class="play-music-loading">
    <n-spin v-if="loading" size="medium">
      <template #description>正在加载分享歌曲...</template>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { usePlayerController } from "@/core/player/PlayerController";
import { useStatusStore, useDataStore } from "@/stores";
import { songDetail } from "@/api/song";
import { formatSongsList } from "@/utils/format";

const route = useRoute();
const router = useRouter();
const player = usePlayerController();
const statusStore = useStatusStore();
const dataStore = useDataStore();

const loading = ref(true);

onMounted(async () => {
  const id = Number(route.query.id);
  if (!id) {
    loading.value = false;
    window.$message.error("分享的歌曲不存在");
    router.replace("/");
    return;
  }

  try {
    const result = await songDetail(id);
    const songs = formatSongsList(result.songs);

    if (songs.length === 0) {
      throw new Error("歌曲不存在");
    }

    const song = songs[0];
    // 清空并设置播放列表
    dataStore.playList = songs;
    statusStore.playIndex = 0;
    // 显示全屏播放器并播放
    statusStore.showFullPlayer = true;
    player.playSong({ song });
  } catch {
    window.$message.error("分享的歌曲不存在");
    router.replace("/");
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="scss" scoped>
.play-music-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>

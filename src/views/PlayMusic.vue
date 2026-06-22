<template>
  <div />
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

onMounted(async () => {
  // 立即回主页，后台加载播放
  router.replace("/");

  const id = Number(route.query.id);
  if (!id) {
    window.$message.error("分享的歌曲不存在");
    return;
  }

  try {
    const result = await songDetail(id);
    const songs = formatSongsList(result.songs);

    if (songs.length === 0) {
      throw new Error("歌曲不存在");
    }

    const song = songs[0];
    dataStore.playList = songs;
    statusStore.playIndex = 0;
    statusStore.showFullPlayer = true;
    player.playSong({ song });
  } catch {
    window.$message.error("分享的歌曲不存在");
  }
});
</script>

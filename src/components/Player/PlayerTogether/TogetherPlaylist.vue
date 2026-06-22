<template>
  <div class="together-playlist">
    <div class="header">
      <n-text class="name">房间歌单</n-text>
      <n-text class="count" depth="3">{{ playlist.length }} 首</n-text>
    </div>
    <n-empty
      v-if="!playlist.length"
      description="房间歌单为空"
      size="small"
      style="margin-top: 40px"
    />
    <div v-else class="tracks">
      <div
        v-for="(track, index) in playlist"
        :key="track.id ?? index"
        class="track-item"
        :class="{ on: isCurrentTrack(track) }"
        @click="handleTrackClick(track, index)"
      >
        <div class="index">
          <n-text v-if="!isCurrentTrack(track)" depth="3">{{ index + 1 }}</n-text>
          <SvgIcon v-else :size="16" name="Music" />
        </div>
        <div class="data">
          <n-text class="name text-hidden">{{ track.name || "未知曲目" }}</n-text>
          <div class="artists">
            <n-text class="ar" depth="3">{{ getArtists(track) }}</n-text>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTogetherStore, useDataStore, useMusicStore } from "@/stores";
import { usePlayerController } from "@/core/player/PlayerController";
import { sendPlayCommand } from "@/composables/useTogether";
import { computed } from "vue";

const togetherStore = useTogetherStore();
const dataStore = useDataStore();
const musicStore = useMusicStore();
const player = usePlayerController();

/** 当前歌单数据源：房主用本地，客人用远端 */
const playlist = computed(() => {
  return togetherStore.isHost ? dataStore.playList : togetherStore.roomPlaylist;
});

/** 判断是否当前播放曲目 */
function isCurrentTrack(track: any) {
  return Number(track.id) === Number(musicStore.playSong.id);
}

/** 获取艺术家名 */
function getArtists(track: any) {
  if (Array.isArray(track.artists)) {
    return track.artists.map((ar: any) => ar.name).join(" / ");
  }
  if (Array.isArray(track.ar)) {
    return track.ar.map((ar: any) => ar.name).join(" / ");
  }
  return track.artists || "未知艺术家";
}

/** 点击歌曲 */
function handleTrackClick(track: any, index: number) {
  if (togetherStore.isHost) {
    // 房主：直接切歌，同步引擎会自动发 GOTO
    player.togglePlayIndex(index, true);
  } else {
    // 客人：发 GOTO 命令
    sendPlayCommand("GOTO", Number(track.id));
  }
}
</script>

<style scoped lang="scss">
.together-playlist {
  .header {
    display: flex;
    flex-direction: column;
    margin-bottom: 8px;

    .count {
      margin-top: 4px;
      font-size: 12px;
    }
  }

  .tracks {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 300px;
    overflow-y: auto;
  }

  .track-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid transparent;
    background-color: rgba(var(--primary), 0.08);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: var(--primary-hex);
    }

    &.on {
      border-color: var(--primary-hex);
      background-color: rgba(var(--primary), 0.29);
    }

    .index {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      min-width: 32px;
      font-size: 13px;
    }

    .data {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;

      .name {
        font-size: 14px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .artists {
        margin-top: 2px;
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

.text-hidden {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

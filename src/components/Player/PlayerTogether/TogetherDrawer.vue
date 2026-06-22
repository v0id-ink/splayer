<!-- 一起听抽屉 -->
<template>
  <n-drawer
    v-model:show="togetherStore.drawerShow"
    :class="{ 'full-player': statusStore.showFullPlayer }"
    :auto-focus="false"
    id="together-drawer"
    style="width: 400px"
  >
    <n-drawer-content :native-scrollbar="false" closable>
      <template #header>
        <div class="drawer-header">
          <n-text class="title">一起听</n-text>
          <n-text class="subtitle" depth="3">
            {{ togetherStore.inRoom ? `房间 ${togetherStore.roomId}` : "未加入房间" }}
          </n-text>
        </div>
      </template>

      <div class="together-content">
        <!-- 房间状态卡片 -->
        <TogetherRoomCard />

        <n-divider v-if="togetherStore.inRoom" style="margin: 16px 0" />

        <!-- 在线用户 -->
        <TogetherUserList v-if="togetherStore.inRoom" />

        <n-divider v-if="togetherStore.inRoom" style="margin: 16px 0" />

        <!-- 房间歌单 -->
        <TogetherPlaylist v-if="togetherStore.inRoom" />
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import TogetherRoomCard from "./TogetherRoomCard.vue";
import TogetherUserList from "./TogetherUserList.vue";
import TogetherPlaylist from "./TogetherPlaylist.vue";
import { useTogetherStore, useStatusStore } from "@/stores";
import { useTogetherSync } from "@/composables/useTogether";

const togetherStore = useTogetherStore();
const statusStore = useStatusStore();

// 启动同步引擎（watch + 防抖 + 防循环）
useTogetherSync();
</script>

<style lang="scss" scoped>
.drawer-header {
  display: flex;
  flex-direction: column;

  .subtitle {
    margin-top: 4px;
    font-size: 12px;
  }
}

.together-content {
  padding: 4px 0;
}
</style>

<style lang="scss">
#together-drawer {
  --n-border-radius: 12px;
  .n-drawer-header {
    height: 70px;
  }
  &.full-player {
    --n-color: rgb(var(--main-cover-color));
    --n-close-icon-color: rgba(var(--main-cover-color), 0.58);
    background-color: transparent;
    box-shadow: none;
    .n-drawer-header,
    .n-drawer-footer {
      border: none;
    }
    a,
    span,
    .n-icon {
      color: rgb(var(--main-cover-color));
    }
    .n-button {
      --n-color: rgba(var(--main-cover-color), 0.08);
      --n-color-hover: rgba(var(--main-cover-color), 0.12);
      --n-color-pressed: var(--n-color);
      --n-color-focus: var(--n-color-hover);
    }
  }
}
</style>

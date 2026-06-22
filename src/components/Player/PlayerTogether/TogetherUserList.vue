<template>
  <div class="user-list">
    <div class="header">
      <span>在线用户</span>
      <n-badge :value="togetherStore.onlineCount" :max="99" type="info" />
    </div>
    <n-empty v-if="!togetherStore.roomUsers.length" description="暂无其他用户" size="small" />
    <div v-else class="users">
      <div v-for="user in togetherStore.roomUsers" :key="user.userId" class="user-item">
        <n-avatar round :size="32" :src="user.avatarUrl" />
        <span class="name">{{ user.nickname }}</span>
        <n-tag v-if="user.userId === togetherStore.inviterId" size="tiny" type="success" round>
          房主
        </n-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTogetherStore } from "@/stores";

const togetherStore = useTogetherStore();
</script>

<style scoped lang="scss">
.user-list {
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    opacity: 0.8;
    margin-bottom: 8px;
  }

  .users {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
  }

  .user-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 4px;
    border-radius: 6px;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .name {
      flex: 1;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>

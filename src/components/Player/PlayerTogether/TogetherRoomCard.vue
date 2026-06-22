<template>
  <div class="room-card">
    <!-- 未在房间 -->
    <template v-if="!togetherStore.inRoom">
      <n-button type="primary" block :loading="creating" @click="handleCreate">
        <template #icon>
          <SvgIcon name="Add" />
        </template>
        创建房间
      </n-button>
      <n-divider style="margin: 12px 0">或</n-divider>
      <n-space vertical :size="12">
        <n-input v-model:value="joinForm.roomId" placeholder="房间 ID" />
        <n-input
          v-model:value="joinForm.inviterId"
          placeholder="邀请者 ID"
          :inputmode="'numeric'"
        />
        <n-button
          block
          secondary
          :loading="joining"
          :disabled="!joinForm.roomId"
          @click="handleJoin"
        >
          加入房间
        </n-button>
      </n-space>
    </template>

    <!-- 在房间 -->
    <template v-else>
      <div class="room-info">
        <div class="info-title">
          <span class="label">房间号</span>
          <n-tag :type="togetherStore.isHost ? 'success' : 'info'" size="small" round>
            {{ togetherStore.isHost ? "房主" : "客人" }}
          </n-tag>
        </div>
        <n-text code class="room-id-text">{{ togetherStore.roomId }}</n-text>
      </div>

      <!-- 分享链接 -->
      <div class="share-link">
        <n-text depth="3" class="label">分享链接</n-text>
        <n-input :value="shareLink" readonly size="small" @click="copyShareLink">
          <template #suffix>
            <n-button text type="primary" @click.stop="copyShareLink">复制</n-button>
          </template>
        </n-input>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <n-button
          size="small"
          :type="togetherStore.isHost ? 'error' : 'warning'"
          :loading="leaving"
          @click="handleLeave"
        >
          {{ togetherStore.isHost ? "关闭房间" : "退出房间" }}
        </n-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useTogetherStore } from "@/stores";
import { createRoom, joinRoom, leaveRoom } from "@/composables/useTogether";
import { useMessage } from "naive-ui";
import { reactive, ref, computed } from "vue";

const togetherStore = useTogetherStore();
const message = useMessage();

const creating = ref(false);
const joining = ref(false);
const leaving = ref(false);
const joinForm = reactive({ roomId: "", inviterId: "" });

const shareLink = computed(() => {
  if (!togetherStore.roomId) return "";
  return `https://st.music.163.com/listen-together/share/?roomId=${togetherStore.roomId}&inviterId=${togetherStore.inviterId}`;
});

async function handleCreate() {
  creating.value = true;
  try {
    await createRoom();
  } finally {
    creating.value = false;
  }
}

async function handleJoin() {
  if (!joinForm.roomId) return;
  joining.value = true;
  try {
    await joinRoom(joinForm.roomId, Number(joinForm.inviterId) || 0);
  } finally {
    joining.value = false;
  }
}

async function handleLeave() {
  leaving.value = true;
  try {
    await leaveRoom();
  } finally {
    leaving.value = false;
  }
}

async function copyShareLink() {
  if (!shareLink.value) return;
  try {
    await navigator.clipboard.writeText(shareLink.value);
    message.success("链接已复制");
  } catch {
    message.error("复制失败");
  }
}
</script>

<style scoped lang="scss">
.room-card {
  padding: 4px 0;
}

.room-info {
  margin-bottom: 16px;

  .info-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .label {
      font-size: 13px;
      opacity: 0.6;
    }
  }

  .room-id-text {
    display: block;
    font-size: 13px;
    word-break: break-all;
  }
}

.share-link {
  margin-bottom: 16px;

  .label {
    display: block;
    font-size: 13px;
    margin-bottom: 8px;
  }
}

.actions {
  margin-top: 4px;
}
</style>

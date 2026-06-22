<!-- 听歌识曲 -->
<template>
  <div class="audio-match">
    <!-- 录制区域 -->
    <div v-if="status !== 'result'" class="record-section">
      <canvas ref="canvasRef" class="wave-canvas" :class="{ active: status === 'recording' }" />
      <n-button
        :type="status === 'recording' ? 'error' : 'primary'"
        :loading="status === 'matching'"
        :disabled="status === 'matching'"
        circle
        size="large"
        class="record-btn"
        @click="toggleRecord"
      >
        <template #icon>
          <SvgIcon :size="24" name="Record" />
        </template>
      </n-button>
      <n-text depth="3" class="status-text">{{ statusText }}</n-text>
    </div>

    <!-- 结果列表 -->
    <div v-else class="result-section">
      <n-empty v-if="!songs.length" description="未识别到歌曲" size="large" />
      <div v-else class="song-list">
        <div
          v-for="(song, index) in songs"
          :key="song.id"
          class="song-item"
          @click="playSong(song)"
        >
          <div class="index">{{ index + 1 }}</div>
          <s-image :src="song.coverSize?.s || song.cover" class="cover" />
          <div class="info">
            <n-ellipsis :line-clamp="1" class="name">{{ song.name }}</n-ellipsis>
            <n-ellipsis :line-clamp="1" class="artist" depth="3">
              {{ formatArtist(song.artists) }}
            </n-ellipsis>
          </div>
          <div class="play-btn">
            <SvgIcon :size="20" name="Play" />
          </div>
        </div>
      </div>
      <n-button block secondary class="retry-btn" @click="reset">
        <template #icon>
          <SvgIcon name="Refresh" />
        </template>
        重新识别
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { audioMatch } from "@/api/audioMatch";
import { songDetail } from "@/api/song";
import { usePlayerController } from "@/core/player/PlayerController";
import { formatSongsList, removeBrackets } from "@/utils/format";
import type { SongType } from "@/types";

/** 最大录制时长（秒） */
const MAX_DURATION = 15;
/** 采样率 */
const SAMPLE_RATE = 8000;

type Status = "idle" | "recording" | "matching" | "result";

const status = ref<Status>("idle");
const songs = ref<SongType[]>([]);
// 录制计时显示
const recordElapsed = ref(0);

const canvasRef = ref<HTMLCanvasElement>();
let audioCtx: AudioContext | null = null;
let recorderNode: AudioWorkletNode | null = null;
let micStream: MediaStream | null = null;
let canvasAnimId: number | null = null;
let audioBuffer: Float32Array | null = null;
let bufferHealth = 0;
let scriptsLoaded = false;
// 录制起始时间戳
let recordStartTime = 0;

const player = usePlayerController();

const emit = defineEmits<{
  close: [];
}>();

/** 格式化歌手名 */
function formatArtist(artists: any): string {
  if (!artists) return "未知艺术家";
  if (typeof artists === "string") return removeBrackets(artists);
  if (Array.isArray(artists)) {
    return artists.map((ar: any) => removeBrackets(ar.name || ar)).join(" / ");
  }
  return "未知艺术家";
}

const statusText = computed(() => {
  switch (status.value) {
    case "idle":
      return "点击按钮开始录音";
    case "recording":
      return `录制中 ${recordElapsed.value.toFixed(1)}s / ${MAX_DURATION}s`;
    case "matching":
      return "正在识别...";
    default:
      return "";
  }
});

/** 动态加载脚本 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`加载失败: ${src}`));
    document.head.appendChild(script);
  });
}

/** 加载 WASM 脚本 */
async function loadScripts() {
  if (scriptsLoaded) return;
  await loadScript("/wasm/audio-match/afp.wasm.js");
  await loadScript("/wasm/audio-match/afp.js");
  scriptsLoaded = true;
}

/** 初始化音频上下文 */
async function initAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  await audioCtx.audioWorklet.addModule("/wasm/audio-match/rec.js");
  recorderNode = new AudioWorkletNode(audioCtx, "timed-recorder");
  recorderNode.port.onmessage = (event: MessageEvent) => {
    const data = event.data;
    switch (data.message) {
      case "finished":
        onRecordingFinished(data.recording);
        break;
      case "bufferhealth":
        bufferHealth = data.health;
        audioBuffer = data.recording;
        break;
      default:
        if (typeof data.message === "string") {
          console.log("[rec.js]", data.message);
        }
    }
  };
  // 麦克风
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
      latency: 0,
    },
  });
  const micSource = audioCtx.createMediaStreamSource(micStream);
  micSource.connect(recorderNode);
}

/** 切换录制状态 */
async function toggleRecord() {
  if (status.value === "recording") {
    // 手动停止录制
    recorderNode?.port.postMessage({ message: "stop" });
  } else if (status.value === "idle") {
    try {
      await loadScripts();
      await initAudio();
      if (audioCtx?.state === "suspended") {
        await audioCtx.resume();
      }
      status.value = "recording";
      bufferHealth = 0;
      audioBuffer = null;
      recordStartTime = Date.now();
      recordElapsed.value = 0;
      recorderNode?.port.postMessage({ message: "start", duration: MAX_DURATION });
      startCanvasAnim();
      // 启动计时显示
      startStatusTimer();
    } catch (err) {
      console.error(err);
      window.$message?.error("无法访问麦克风，请检查权限");
    }
  }
}

// 状态文本计时器
let statusTimer: ReturnType<typeof setInterval> | null = null;
function startStatusTimer() {
  if (statusTimer) clearInterval(statusTimer);
  statusTimer = setInterval(() => {
    recordElapsed.value = Math.min(MAX_DURATION, (Date.now() - recordStartTime) / 1000);
  }, 100);
}
function stopStatusTimer() {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
}

/** 录制完成 */
async function onRecordingFinished(recording: Float32Array) {
  status.value = "matching";
  stopCanvasAnim();
  stopStatusTimer();
  // 实际录制时长（秒）
  const duration = Math.min(MAX_DURATION, (Date.now() - recordStartTime) / 1000);
  try {
    // 生成指纹
    const generateFP = (window as any).GenerateFP as (arr: Float32Array) => Promise<string>;
    if (!generateFP) throw new Error("指纹生成器未加载");
    const fp = await generateFP(recording);
    // 调用识别 API
    const res: any = await audioMatch(duration, fp);
    const result = res?.data?.result;
    if (!result || !Array.isArray(result) || !result.length) {
      songs.value = [];
      status.value = "result";
      return;
    }
    // 获取歌曲详情
    const ids = result.map((r: any) => r.song.id);
    const detailRes: any = await songDetail(ids);
    songs.value = formatSongsList(detailRes?.songs || []);
    status.value = "result";
  } catch (err) {
    console.error("识别失败", err);
    window.$message?.error("识别失败，请重试");
    status.value = "idle";
  }
}

/** 播放歌曲 */
function playSong(song: SongType) {
  player.addNextSong(song, true);
  emit("close");
}

/** 重置 */
function reset() {
  songs.value = [];
  status.value = "idle";
  bufferHealth = 0;
  audioBuffer = null;
}

/** 启动波形动画 */
function startCanvasAnim() {
  const draw = () => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    if (audioBuffer) {
      ctx.fillStyle = "var(--primary-hex)";
      const len = Math.floor(audioBuffer.length * bufferHealth);
      for (let x = 0; x < w; x++) {
        const idx = Math.floor((x / w) * len);
        if (idx >= audioBuffer.length) break;
        const y = audioBuffer[idx];
        const z = Math.abs(y) * (h / 2);
        ctx.fillRect(x, h / 2 - (y > 0 ? z : 0), 1, z);
      }
    }
    canvasAnimId = requestAnimationFrame(draw);
  };
  draw();
}

/** 停止波形动画 */
function stopCanvasAnim() {
  if (canvasAnimId !== null) {
    cancelAnimationFrame(canvasAnimId);
    canvasAnimId = null;
  }
}

onBeforeUnmount(() => {
  stopCanvasAnim();
  stopStatusTimer();
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
});
</script>

<style scoped lang="scss">
.audio-match {
  width: 100%;
}

.record-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
}

.wave-canvas {
  width: 100%;
  height: 0;
  border-radius: 8px;
  background: rgba(var(--primary), 0.05);
  transition: height 0.2s ease;

  &.active {
    height: 120px;
  }
}

.record-btn {
  width: 64px;
  height: 64px;
}

.status-text {
  font-size: 13px;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.song-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 360px;
  overflow-y: auto;
}

.song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(var(--primary), 0.08);

    .play-btn {
      opacity: 1;
    }
  }

  .index {
    width: 24px;
    text-align: center;
    font-size: 13px;
    opacity: 0.6;
  }

  .cover {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .info {
    flex: 1;
    min-width: 0;

    .name {
      font-size: 14px;
    }

    .artist {
      font-size: 12px;
      margin-top: 2px;
    }
  }

  .play-btn {
    opacity: 0;
    transition: opacity 0.2s;
    color: var(--primary-hex);
  }
}

.retry-btn {
  margin-top: 4px;
}
</style>

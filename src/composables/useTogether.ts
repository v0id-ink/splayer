import { useTogetherStore, useStatusStore, useMusicStore, useDataStore } from "@/stores";
import {
  createRoom as apiCreateRoom,
  acceptJoin as apiAcceptJoin,
  checkRoom as apiCheckRoom,
  getStatus as apiGetStatus,
  endRoom as apiEndRoom,
  heartbeat as apiHeartbeat,
  playCommand as apiPlayCommand,
  syncListCommand as apiSyncListCommand,
  syncPlaylistGet as apiSyncPlaylistGet,
  type CommandType,
  type PlayStatus,
} from "@/api/listenTogether";
import { songDetail } from "@/api/song";

/** 轮询间隔 */
const POLL_STATUS_INTERVAL = 5000;
const POLL_PLAYLIST_INTERVAL = 5000;
const HEARTBEAT_INTERVAL = 10000;
/** 防抖延迟 */
const SEEK_DEBOUNCE = 300;
const LIST_DEBOUNCE = 500;

let statusTimer: ReturnType<typeof setInterval> | null = null;
let playlistTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let seekDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let listDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/** 创建房间（房主） */
export async function createRoom() {
  const togetherStore = useTogetherStore();
  const dataStore = useDataStore();
  const message = useMessage();
  try {
    const res: any = await apiCreateRoom();
    if (res.code !== 200) {
      message.error("创建房间失败: " + (res.message || "未知错误"));
      return false;
    }
    const roomId = res.data.roomInfo.roomId;
    togetherStore.setRoom(roomId, dataStore.userData.userId, true);
    await apiCheckRoom(roomId);
    message.success("房间已创建");
    startPolling();
    await syncPlaylistToRemote();
    return true;
  } catch (err) {
    console.error(err);
    message.error("创建房间出错");
    return false;
  }
}

/** 加入房间（客人） */
export async function joinRoom(roomId: string, inviterId: number) {
  const togetherStore = useTogetherStore();
  const message = useMessage();
  try {
    const res: any = await apiAcceptJoin(roomId, inviterId);
    if (res.code !== 200) {
      message.error("加入房间失败: " + (res.message || "未知错误"));
      return false;
    }
    togetherStore.setRoom(roomId, inviterId, false);
    await apiCheckRoom(roomId);
    message.success("已加入房间");
    startPolling();
    await fetchRemotePlaylist();
    return true;
  } catch (err) {
    console.error(err);
    message.error("加入房间出错");
    return false;
  }
}

/** 退出/关闭房间 */
export async function leaveRoom() {
  const togetherStore = useTogetherStore();
  const message = useMessage();
  if (!togetherStore.roomId) return;
  stopPolling();
  try {
    const res: any = await apiEndRoom(togetherStore.roomId);
    if (res.code !== 200 || !res.data?.success) {
      message.warning("房间关闭失败");
    } else {
      message.success(togetherStore.isHost ? "房间已关闭" : "已退出房间");
    }
  } catch (err) {
    console.error(err);
  } finally {
    togetherStore.clearRoom();
  }
}

/** 房主：发送播放命令 */
export async function sendPlayCommand(commandType: CommandType, targetSongId?: number) {
  const togetherStore = useTogetherStore();
  const statusStore = useStatusStore();
  const musicStore = useMusicStore();
  if (!togetherStore.inRoom || !togetherStore.isHost) return;
  if (togetherStore.isApplyingRemoteUpdate) return;
  try {
    await apiPlayCommand({
      roomId: togetherStore.roomId!,
      commandType,
      progress: Math.floor(statusStore.currentTime * 1000),
      playStatus: statusStore.playStatus ? "PLAY" : "PAUSE",
      formerSongId: "-1",
      targetSongId: targetSongId ?? musicStore.playSong.id,
      clientSeq: togetherStore.nextClientSeq(),
    });
  } catch (err) {
    console.warn("发送播放命令失败", err);
  }
}

/** 房主：同步歌单到远端（防抖） */
export function syncPlaylistToRemote() {
  if (listDebounceTimer) clearTimeout(listDebounceTimer);
  listDebounceTimer = setTimeout(doSyncPlaylistToRemote, LIST_DEBOUNCE);
}

async function doSyncPlaylistToRemote() {
  const togetherStore = useTogetherStore();
  const dataStore = useDataStore();
  if (!togetherStore.inRoom || !togetherStore.isHost) return;
  if (togetherStore.isApplyingRemoteUpdate) return;
  const ids = dataStore.playList.map((s: any) => s.id).join(",");
  if (!ids) return;
  try {
    await apiSyncListCommand({
      roomId: togetherStore.roomId!,
      commandType: "REPLACE",
      userId: dataStore.userData.userId,
      version: togetherStore.nextClientSeq(),
      randomList: ids,
      displayList: ids,
    });
  } catch (err) {
    console.warn("同步歌单失败", err);
  }
}

/** 房主：seek 防抖 */
export function debouncedSeek() {
  if (seekDebounceTimer) clearTimeout(seekDebounceTimer);
  seekDebounceTimer = setTimeout(() => {
    sendPlayCommand("seek");
  }, SEEK_DEBOUNCE);
}

/** 启动轮询 */
export function startPolling() {
  stopPolling();
  statusTimer = setInterval(pollStatus, POLL_STATUS_INTERVAL);
  playlistTimer = setInterval(pollPlaylist, POLL_PLAYLIST_INTERVAL);
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
}

/** 停止轮询 */
export function stopPolling() {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
  if (playlistTimer) {
    clearInterval(playlistTimer);
    playlistTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (seekDebounceTimer) {
    clearTimeout(seekDebounceTimer);
    seekDebounceTimer = null;
  }
  if (listDebounceTimer) {
    clearTimeout(listDebounceTimer);
    listDebounceTimer = null;
  }
}

/** 轮询房间状态 */
async function pollStatus() {
  const togetherStore = useTogetherStore();
  if (!togetherStore.inRoom) return;
  try {
    const res: any = await apiGetStatus();
    if (res.code !== 200 || !res.data?.inRoom) {
      stopPolling();
      togetherStore.clearRoom();
      return;
    }
    togetherStore.updateRoomUsers(res.data.roomInfo?.roomUsers || []);
  } catch (err) {
    console.warn("轮询房间状态失败", err);
  }
}

/** 轮询房间歌单（仅客人） */
async function pollPlaylist() {
  const togetherStore = useTogetherStore();
  if (!togetherStore.inRoom || togetherStore.isHost) return;
  try {
    await fetchRemotePlaylist();
  } catch (err) {
    console.warn("轮询房间歌单失败", err);
  }
}

/** 拉取远端歌单并应用（客人） */
async function fetchRemotePlaylist() {
  const togetherStore = useTogetherStore();
  if (!togetherStore.inRoom) return;
  const res: any = await apiSyncPlaylistGet(togetherStore.roomId!);
  if (res.code !== 200) return;
  const result = res.data?.playlist?.displayList?.result;
  if (!result || !Array.isArray(result)) return;
  const ids = result.join(",");
  if (ids === togetherStore.roomPlaylistIds) return;
  togetherStore.setApplyingRemote(true);
  try {
    const detailRes: any = await songDetail(result);
    togetherStore.setRoomPlaylist(detailRes?.songs || [], ids);
  } catch (err) {
    console.warn("获取房间歌单详情失败", err);
  } finally {
    togetherStore.setApplyingRemote(false);
  }
}

/** 心跳保活 */
async function sendHeartbeat() {
  const togetherStore = useTogetherStore();
  const statusStore = useStatusStore();
  const musicStore = useMusicStore();
  if (!togetherStore.inRoom) return;
  try {
    await apiHeartbeat(
      togetherStore.roomId!,
      musicStore.playSong.id,
      (statusStore.playStatus ? "PLAY" : "PAUSE") as PlayStatus,
      Math.floor(statusStore.currentTime * 1000),
    );
  } catch (err) {
    console.warn("心跳失败", err);
  }
}

/** 同步引擎 composable，在组件 setup 中调用 */
export function useTogetherSync() {
  const togetherStore = useTogetherStore();
  const statusStore = useStatusStore();
  const musicStore = useMusicStore();
  const dataStore = useDataStore();

  // 房主：播放状态变化
  watch(
    () => statusStore.playStatus,
    (newVal) => {
      if (!togetherStore.isHost || !togetherStore.inRoom) return;
      if (togetherStore.isApplyingRemoteUpdate) return;
      sendPlayCommand(newVal ? "PLAY" : "PAUSE");
    },
  );

  // 房主：切歌
  watch(
    () => musicStore.playSong.id,
    (newId) => {
      if (!togetherStore.isHost || !togetherStore.inRoom) return;
      if (togetherStore.isApplyingRemoteUpdate) return;
      if (!newId) return;
      sendPlayCommand("GOTO", newId);
    },
  );

  // 房主：进度变化（防抖）
  watch(
    () => statusStore.currentTime,
    () => {
      if (!togetherStore.isHost || !togetherStore.inRoom) return;
      if (togetherStore.isApplyingRemoteUpdate) return;
      debouncedSeek();
    },
  );

  // 房主：歌单变化（防抖）
  watch(
    () => dataStore.playList,
    () => {
      if (!togetherStore.isHost || !togetherStore.inRoom) return;
      if (togetherStore.isApplyingRemoteUpdate) return;
      syncPlaylistToRemote();
    },
    { deep: true },
  );

  onUnmounted(() => {
    stopPolling();
  });
}

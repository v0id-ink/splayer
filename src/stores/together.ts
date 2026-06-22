import type { TogetherUser } from "@/api/listenTogether";
import { defineStore } from "pinia";

interface TogetherState {
  /** 房间 ID */
  roomId: string | null;
  /** 邀请者 ID（房主） */
  inviterId: number;
  /** 是否房主 */
  isHost: boolean;
  /** 在线用户列表 */
  roomUsers: TogetherUser[];
  /** 房间歌单（客人侧用） */
  roomPlaylist: any[];
  /** 房间歌单 ID 列表（逗号分隔字符串） */
  roomPlaylistIds: string;
  /** 命令序号（乐观锁） */
  clientSeq: number;
  /** 同步状态 */
  syncStatus: "idle" | "syncing" | "error";
  /** 防循环标志 */
  isApplyingRemoteUpdate: boolean;
  /** 抽屉显示状态 */
  drawerShow: boolean;
}

export const useTogetherStore = defineStore("together", {
  state: (): TogetherState => ({
    roomId: null,
    inviterId: 0,
    isHost: false,
    roomUsers: [],
    roomPlaylist: [],
    roomPlaylistIds: "",
    clientSeq: 1,
    syncStatus: "idle",
    isApplyingRemoteUpdate: false,
    drawerShow: false,
  }),
  getters: {
    /** 是否在房间中 */
    inRoom: (state) => state.roomId !== null,
    /** 在线人数 */
    onlineCount: (state) => state.roomUsers.length,
  },
  actions: {
    /** 设置房间信息 */
    setRoom(roomId: string, inviterId: number, isHost: boolean) {
      this.roomId = roomId;
      this.inviterId = inviterId;
      this.isHost = isHost;
      this.clientSeq = 1;
    },
    /** 清空房间 */
    clearRoom() {
      this.roomId = null;
      this.inviterId = 0;
      this.isHost = false;
      this.roomUsers = [];
      this.roomPlaylist = [];
      this.roomPlaylistIds = "";
      this.clientSeq = 1;
      this.syncStatus = "idle";
      this.isApplyingRemoteUpdate = false;
    },
    /** 更新在线用户 */
    updateRoomUsers(users: TogetherUser[]) {
      this.roomUsers = users || [];
    },
    /** 设置房间歌单 */
    setRoomPlaylist(tracks: any[], ids: string) {
      this.roomPlaylist = tracks || [];
      this.roomPlaylistIds = ids;
    },
    /** 递增并返回 clientSeq */
    nextClientSeq() {
      return this.clientSeq++;
    },
    /** 设置防循环标志 */
    setApplyingRemote(flag: boolean) {
      this.isApplyingRemoteUpdate = flag;
    },
    /** 切换抽屉显示 */
    toggleDrawer(show?: boolean) {
      this.drawerShow = show ?? !this.drawerShow;
    },
  },
});

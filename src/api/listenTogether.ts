import request from "@/utils/request";

/** 一起听命令类型 */
export type CommandType = "PLAY" | "PAUSE" | "seek" | "GOTO";
/** 一起听播放状态 */
export type PlayStatus = "PLAY" | "PAUSE";
/** 一起听歌单变更类型 */
export type ListCommandType = "REPLACE";

/** 房间用户 */
export interface TogetherUser {
  userId: number;
  nickname: string;
  avatarUrl: string;
}

/** 创建房间 */
export const createRoom = () => {
  return request({
    url: "/listentogether/room/create",
    method: "get",
    params: { timestamp: Date.now() },
  });
};

/** 加入房间 */
export const acceptJoin = (roomId: string, inviterId: number) => {
  return request({
    url: "/listentogether/play/invitation/accept",
    method: "post",
    params: { roomId, inviterId, refer: "inbox_invite", timestamp: Date.now() },
  });
};

/** 检查房间情况 */
export const checkRoom = (roomId: string) => {
  return request({
    url: "/listentogether/room/check",
    method: "post",
    params: { roomId, timestamp: Date.now() },
  });
};

/** 获取房间状态 */
export const getStatus = () => {
  return request({
    url: "/listentogether/status",
    method: "get",
    params: { timestamp: Date.now() },
  });
};

/** 结束房间 */
export const endRoom = (roomId: string) => {
  return request({
    url: "/listentogether/end",
    method: "post",
    params: { roomId, timestamp: Date.now() },
  });
};

/** 心跳保活 */
export const heartbeat = (
  roomId: string,
  songId: number,
  playStatus: PlayStatus,
  progress: number,
) => {
  return request({
    url: "/listentogether/heartbeat",
    method: "post",
    params: { roomId, songId, playStatus, progress, timestamp: Date.now() },
  });
};

/** 发送播放命令 */
export const playCommand = (params: {
  roomId: string;
  commandType: CommandType;
  progress: number;
  playStatus: PlayStatus;
  formerSongId: string;
  targetSongId: number;
  clientSeq: number;
}) => {
  return request({
    url: "/listentogether/play/command",
    method: "post",
    params: { ...params, timestamp: Date.now() },
  });
};

/** 更新房间歌单 */
export const syncListCommand = (params: {
  roomId: string;
  commandType: ListCommandType;
  userId: number;
  version: number;
  randomList: string;
  displayList: string;
}) => {
  return request({
    url: "/listentogether/sync/list/command",
    method: "post",
    params: { ...params, timestamp: Date.now() },
  });
};

/** 获取房间歌单 */
export const syncPlaylistGet = (roomId: string) => {
  return request({
    url: "/listentogether/sync/playlist/get",
    method: "post",
    params: { roomId, timestamp: Date.now() },
  });
};

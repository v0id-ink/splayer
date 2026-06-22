import request from "@/utils/request";

/** 听歌识曲匹配结果项 */
export interface AudioMatchResult {
  /** 歌曲 id */
  songId: number;
  /** 歌曲名 */
  songName: string;
  /** 歌手名 */
  artistName: string;
  /** 专辑名 */
  albumName: string;
  /** 匹配起始时间（秒） */
  startTime: number;
}

/** 听歌识曲 */
export const audioMatch = (duration: number, audioFP: string) => {
  return request({
    url: "/audio/match",
    method: "post",
    params: { duration, audioFP },
  });
};

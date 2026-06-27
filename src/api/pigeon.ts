/**
 * PigeonCDN API
 * 提供节奏游戏音乐（Phigros、Rizline）的搜索与播放
 */

import type { SongType } from "@/types/main";

/** CDN 基础地址 */
const PIGEON_CDN_BASE = "https://pigeon-cdn.c0ffee.space";

/** 索引地址 */
const PIGEON_INDEX_URL = `${PIGEON_CDN_BASE}/index.json`;

/** 缓存有效期（1 小时） */
const CACHE_TTL = 60 * 60 * 1000;

/** PigeonCDN 索引中的歌曲 */
interface PigeonSong {
  /** 来源游戏 */
  game: string;
  /** 歌曲名称 */
  name: string;
  /** 作曲者 */
  composer: string;
  /** 音频相对路径 */
  audio: string;
  /** 封面相对路径 */
  illustration: string;
}

/** PigeonCDN 索引结构 */
interface PigeonIndex {
  schema: string;
  updatedAt: string;
  games: Record<string, { version: string; count: number }>;
  songs: PigeonSong[];
}

/** 缓存 */
let cachedIndex: PigeonIndex | null = null;
let cachedTime = 0;

/**
 * 将字符串哈希为数字 ID
 * PigeonCDN ID 以 1003 开头
 */
const stringToNumericId = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Number(`1003${Math.abs(hash)}`);
};

/**
 * 拉取 PigeonCDN 索引
 * 带内存缓存，过期后自动刷新
 */
export const fetchPigeonIndex = async (force = false): Promise<PigeonIndex> => {
  const now = Date.now();
  if (!force && cachedIndex && now - cachedTime < CACHE_TTL) {
    return cachedIndex;
  }
  const response = await fetch(PIGEON_INDEX_URL);
  if (!response.ok) {
    throw new Error(`PigeonCDN 索引获取失败: ${response.status}`);
  }
  const data = (await response.json()) as PigeonIndex;
  cachedIndex = data;
  cachedTime = now;
  return data;
};

/**
 * 将 PigeonCDN 歌曲转换为统一 SongType
 */
export const formatPigeonSong = (song: PigeonSong): SongType => ({
  id: stringToNumericId(song.audio),
  name: song.name,
  artists: [{ id: 0, name: song.composer }],
  album: { id: 0, name: song.game },
  cover: `${PIGEON_CDN_BASE}/${song.illustration}`,
  duration: 0,
  type: "pigeon",
  streamUrl: `${PIGEON_CDN_BASE}/${song.audio}`,
  free: 0,
  mv: null,
});

/**
 * 搜索 PigeonCDN 歌曲
 * 客户端按歌名和作曲者过滤
 */
export const searchPigeonSongs = async (keyword: string): Promise<SongType[]> => {
  if (!keyword.trim()) return [];
  const index = await fetchPigeonIndex();
  const lowerKeyword = keyword.toLowerCase();
  const matched = index.songs.filter(
    (song) =>
      song.name.toLowerCase().includes(lowerKeyword) ||
      song.composer.toLowerCase().includes(lowerKeyword),
  );
  return matched.map(formatPigeonSong);
};

/**
 * 获取 PigeonCDN 索引更新时间
 */
export const getPigeonIndexUpdatedAt = async (): Promise<string | null> => {
  const index = await fetchPigeonIndex();
  return index.updatedAt || null;
};

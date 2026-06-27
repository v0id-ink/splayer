/**
 * PigeonCDN API
 * 提供节奏游戏音乐（Phigros、Rizline）的搜索与播放
 */

import type { SongType, CoverType } from "@/types/main";

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
 * 将音频路径哈希为数字
 */
const hashAudioPath = (audio: string): number => {
  let hash = 0;
  for (let i = 0; i < audio.length; i++) {
    const char = audio.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

/**
 * 将字符串哈希为数字 ID
 * PigeonCDN ID 以 1003 开头
 */
const stringToNumericId = (audio: string): number => {
  return Number(`1003${hashAudioPath(audio)}`);
};

/**
 * 生成 pigeon_ 前缀的原始 ID（用于分享链接）
 */
const toPigeonOriginalId = (audio: string): string => {
  return `pigeon_${hashAudioPath(audio)}`;
};

/**
 * 将游戏名哈希为专辑数字 ID
 * PigeonCDN 专辑 ID 以 1004 开头
 */
const hashGameName = (game: string): number => {
  let hash = 0;
  for (let i = 0; i < game.length; i++) {
    const char = game.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Number(`1004${Math.abs(hash)}`);
};

/** 判断是否为 PigeonCDN 专辑 ID */
export const isPigeonAlbumId = (id: number | string): boolean => {
  return String(id).startsWith("1004");
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
  originalId: toPigeonOriginalId(song.audio),
  name: song.name,
  artists: [{ id: 0, name: song.composer }],
  album: { id: hashGameName(song.game), name: song.game },
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

/**
 * 根据 pigeon_ 前缀的原始 ID 查找歌曲
 */
export const getPigeonSongByOriginalId = async (
  originalId: string,
): Promise<SongType | null> => {
  if (!originalId.startsWith("pigeon_")) return null;
  const hash = originalId.slice("pigeon_".length);
  const index = await fetchPigeonIndex();
  const matched = index.songs.find((song) => String(hashAudioPath(song.audio)) === hash);
  return matched ? formatPigeonSong(matched) : null;
};

/**
 * 根据专辑 ID 获取 PigeonCDN 专辑详情和歌曲列表
 */
export const getPigeonAlbumDetail = async (
  albumId: number,
): Promise<{ detail: CoverType; songs: SongType[] } | null> => {
  const index = await fetchPigeonIndex();
  // 反查游戏名
  const gameEntry = Object.entries(index.games).find(
    ([game]) => hashGameName(game) === albumId,
  );
  if (!gameEntry) return null;
  const [gameName, gameInfo] = gameEntry;
  const gameSongs = index.songs.filter((song) => song.game === gameName);
  const songs = gameSongs.map(formatPigeonSong);
  const detail: CoverType = {
    id: albumId,
    name: gameName,
    cover:
      gameSongs.length > 0 ? `${PIGEON_CDN_BASE}/${gameSongs[0].illustration}` : "",
    description: `PigeonCDN · ${gameName} v${gameInfo.version}`,
    count: songs.length,
  };
  return { detail, songs };
};

/**
 * TMDB（The Movie Database）剧集搜索客户端。
 *
 * 用于「剧集模式」联网搜索剧名，拼装成 `剧名.年份`（点分隔），
 * 配合季数 + 自动集数生成 `Show.Name.Year.S01E01` 这类标准命名。
 *
 * API Key 由用户自行在 themoviedb.org 免费申请并填入，保存在 localStorage，
 * 不内置、不外泄。同时支持 v3 API Key（32 位）与 v4 Read Access Token（JWT）。
 */
import gmGet from "@/utils/gmRequest";

const TMDB_BASE = "https://api.themoviedb.org/3";
const STORAGE_KEY = "cdp_tmdb_api_key";
const LANG_KEY = "cdp_tmdb_language";

export interface ITmdbTv {
  id: number;
  name: string;
  original_name: string;
  first_air_date?: string;
  overview?: string;
}

export const getApiKey = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

export const setApiKey = (value: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, (value || "").trim());
  } catch {
    /* ignore */
  }
};

export const getLanguage = (): string => {
  try {
    return localStorage.getItem(LANG_KEY) || "en-US";
  } catch {
    return "en-US";
  }
};

export const setLanguage = (value: string): void => {
  try {
    localStorage.setItem(LANG_KEY, value || "en-US");
  } catch {
    /* ignore */
  }
};

// 剧名 → 点分隔、去除文件名非法字符
export const toDotName = (name: string): string =>
  (name || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "") // 文件名非法字符
    .replace(/[\s._]+/g, ".") // 空白/下划线/连续点 → 单个点
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");

// 拼成 `剧名.年份`
export const formatSeriesTitle = (name: string, firstAirDate?: string): string => {
  const year = (firstAirDate || "").slice(0, 4);
  const dot = toDotName(name);
  return year && /^\d{4}$/.test(year) ? `${dot}.${year}` : dot;
};

export class TmdbError extends Error {
  code: "NO_KEY" | "UNAUTHORIZED" | "HTTP" | "NETWORK";
  constructor(code: TmdbError["code"], message?: string) {
    super(message || code);
    this.code = code;
    this.name = "TmdbError";
  }
}

export const searchTv = async (query: string): Promise<ITmdbTv[]> => {
  const key = getApiKey();
  if (!key) {
    throw new TmdbError("NO_KEY");
  }
  const q = encodeURIComponent((query || "").trim());
  if (!q) {
    return [];
  }
  const lang = encodeURIComponent(getLanguage());
  const isV4Token = key.split(".").length === 3; // JWT 有两个点
  const base = `${TMDB_BASE}/search/tv?query=${q}&language=${lang}&include_adult=false&page=1`;
  const url = isV4Token ? base : `${base}&api_key=${key}`;
  const headers = isV4Token ? { Authorization: `Bearer ${key}` } : undefined;

  let res;
  try {
    res = await gmGet(url, headers);
  } catch (e) {
    throw new TmdbError("NETWORK", (e as Error)?.message);
  }
  if (res.status === 401) {
    throw new TmdbError("UNAUTHORIZED");
  }
  if (res.status < 200 || res.status >= 300) {
    throw new TmdbError("HTTP", "HTTP " + res.status);
  }
  try {
    const data = JSON.parse(res.responseText);
    return Array.isArray(data.results) ? (data.results as ITmdbTv[]) : [];
  } catch {
    throw new TmdbError("HTTP", "invalid response");
  }
};

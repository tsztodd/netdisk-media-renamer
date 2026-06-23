/**
 * 跨域 GET 请求封装。
 *
 * 油猴脚本里访问 TMDB（api.themoviedb.org）属于跨域请求，需要
 * `GM_xmlhttpRequest`（配合 @grant GM_xmlhttpRequest 与 @connect）。
 * 在 web-extension 等没有 GM API 的环境下回退到普通 fetch。
 */

export interface IGmResponse {
  status: number;
  responseText: string;
}

export const gmGet = (
  url: string,
  headers?: Record<string, string>
): Promise<IGmResponse> => {
  if (typeof GM_xmlhttpRequest === "function") {
    return new Promise<IGmResponse>((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers,
        timeout: 15000,
        onload: (res: { status: number; responseText: string }) =>
          resolve({ status: res.status, responseText: res.responseText }),
        onerror: () => reject(new Error("network error")),
        ontimeout: () => reject(new Error("timeout")),
      });
    });
  }

  // 回退：普通 fetch（仅当目标支持 CORS 时可用）
  return fetch(url, { headers }).then(async (res) => ({
    status: res.status,
    responseText: await res.text(),
  }));
};

export default gmGet;

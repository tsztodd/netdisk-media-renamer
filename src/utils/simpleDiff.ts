import type { Change } from "diff";

/**
 * 轻量级文件名差异算法。
 *
 * 原实现使用 `diff` 包的 `diffChars`（Myers 算法，最坏 O(N*D)，当新旧名称
 * 差异很大时接近 O(N²)），并且为每个字符生成一个 DOM 节点。在 50+ 个文件、
 * 每次输入都全量重算的场景下会阻塞主线程导致页面卡死。
 *
 * 对“重命名预览”这个场景而言，并不需要精确的最小编辑脚本——只需要直观地标出
 * “哪一段被删除、哪一段被新增”。这里采用 公共前缀 + 公共后缀 的 O(N) 算法，
 * 至多产生 4 个片段（前缀、删除段、新增段、后缀），渲染开销极低。
 *
 * 返回结构与 `diff` 的 `Change[]` 兼容：
 *  - 过滤掉 `added` 后顺序拼接 === 旧文件名
 *  - 过滤掉 `removed` 后顺序拼接 === 新文件名
 */
export function simpleDiff(oldStr: string, newStr: string): Change[] {
  const common = (value: string): Change => ({ value, added: false, removed: false });
  const removed = (value: string): Change => ({ value, added: false, removed: true });
  const added = (value: string): Change => ({ value, added: true, removed: false });

  if (oldStr === newStr) {
    return oldStr ? [common(oldStr)] : [];
  }

  const oldLen = oldStr.length;
  const newLen = newStr.length;
  const minLen = Math.min(oldLen, newLen);

  // 公共前缀长度
  let prefix = 0;
  while (prefix < minLen && oldStr.charCodeAt(prefix) === newStr.charCodeAt(prefix)) {
    prefix++;
  }

  // 公共后缀长度（不与前缀重叠）
  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    oldStr.charCodeAt(oldLen - 1 - suffix) === newStr.charCodeAt(newLen - 1 - suffix)
  ) {
    suffix++;
  }

  const removedMid = oldStr.slice(prefix, oldLen - suffix);
  const addedMid = newStr.slice(prefix, newLen - suffix);

  const result: Change[] = [];
  if (prefix > 0) {
    result.push(common(oldStr.slice(0, prefix)));
  }
  if (removedMid) {
    result.push(removed(removedMid));
  }
  if (addedMid) {
    result.push(added(addedMid));
  }
  if (suffix > 0) {
    result.push(common(oldStr.slice(oldLen - suffix)));
  }
  return result;
}

export default simpleDiff;

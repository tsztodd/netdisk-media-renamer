/**
 * 从原文件名中提取「集数」。
 *
 * 很常见的场景：文件名本身就是集数（如 01.mkv … 12.mkv），或带有
 * E12 / EP12 / 第12集 / 12话 之类标记。这种情况下，集数应当来自文件名，
 * 而不是按列表顺序编号（列表可能是倒序或乱序，按顺序编号会全错）。
 *
 * 返回提取到的整数；提取不到返回 undefined（调用方可回退到顺序序号）。
 */
export const extractEpisode = (name: string): number | undefined => {
  if (!name) {
    return undefined;
  }
  const s = String(name).trim();

  // 1) 显式集数标记，优先级最高
  const markers: RegExp[] = [
    /(?:^|[^a-z0-9])(?:ep?|episode)[\s._-]*(\d{1,4})/i, // E12 / EP12 / Episode 12
    /第\s*(\d{1,4})\s*[集話话期]/, // 第12集 / 第 12 期
    /(\d{1,4})\s*[集話话]/, // 12集 / 12话
  ];
  for (const re of markers) {
    const m = s.match(re);
    if (m) {
      return parseInt(m[1], 10);
    }
  }

  // 2) 回退：取名字里的数字
  const nums = s.match(/\d+/g);
  if (!nums || !nums.length) {
    return undefined;
  }
  if (nums.length === 1) {
    return parseInt(nums[0], 10);
  }
  // 多个数字时，排除疑似年份（1900–2099 的 4 位数），取最后一个
  const filtered = nums.filter((n) => {
    const v = parseInt(n, 10);
    return !(n.length === 4 && v >= 1900 && v <= 2099);
  });
  const pick = filtered.length ? filtered : nums;
  return parseInt(pick[pick.length - 1], 10);
};

export default extractEpisode;

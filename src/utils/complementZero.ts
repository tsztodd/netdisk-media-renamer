import { isString } from "@/utils/is";

// 补零
export const complementZero = (payload: number | string, maxLength: number = 2): string => {
  if (isString(payload)) {
    payload = parseInt(payload);
    if (isNaN(payload)) {
      return "";
    }
  }
  // 注意：当数字位数已超过 maxLength（如 100 集、或 4 位年份）时，
  // 差值为负，"0".repeat(负数) 会抛 RangeError，必须 clamp 到 0。
  return "0".repeat(Math.max(0, maxLength - (payload + "").length)) + payload;
};

export default complementZero;

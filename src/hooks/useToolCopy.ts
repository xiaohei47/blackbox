import { useCallback } from "react";
import { message } from "antd";

/**
 * Shared hook: copy text to clipboard with user feedback.
 * Every tool panel uses the exact same pattern.
 */
export function useToolCopy(output: string): () => Promise<void> {
  return useCallback(async () => {
    if (!output) {
      message.warning("没有可复制的内容");
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      message.success("已复制");
    } catch {
      message.error("复制失败");
    }
  }, [output]);
}

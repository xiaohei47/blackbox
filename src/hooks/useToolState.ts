import { useState, useCallback } from "react";
import { useToolCopy } from "./useToolCopy";

/**
 * Shared hook for tools with input → output → copy → clear lifecycle.
 * Used across Base64Tool, UrlTool, HexTool, UnicodeTool, HashTool, HmacTool.
 */
export function useToolState() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const handleCopy = useToolCopy(output);
  const handleClear = useCallback(() => { setInput(""); setOutput(""); }, []);
  return { input, setInput, output, setOutput, handleCopy, handleClear };
}

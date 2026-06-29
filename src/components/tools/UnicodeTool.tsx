import React, { useState, useCallback } from "react";
import { Input, Button, message } from "antd";
import {
  ThunderboltOutlined,
  CopyOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

const { TextArea } = Input;

const UnicodeTool: React.FC = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const handleEncode = useCallback(() => {
    if (!input) { message.warning("请输入内容"); return; }
    try {
      setOutput(
        Array.from(input)
          .map((ch) => {
            const cp = ch.codePointAt(0)!;
            if (cp < 0x80) return ch;
            return "\\u" + cp.toString(16).toUpperCase().padStart(4, "0");
          })
          .join(""),
      );
    } catch (e) { setOutput("编码失败：" + (e instanceof Error ? e.message : String(e))); }
  }, [input]);

  const handleDecode = useCallback(() => {
    if (!input) { message.warning("请输入内容"); return; }
    try {
      setOutput(
        input.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
          String.fromCodePoint(parseInt(hex, 16)),
        ),
      );
    } catch { setOutput("解码失败：无效的 Unicode 转义序列"); }
  }, [input]);

  const handleCopy = useCallback(async () => {
    if (!output) { message.warning("没有可复制的内容"); return; }
    try { await navigator.clipboard.writeText(output); message.success("已复制"); }
    catch { message.error("复制失败"); }
  }, [output]);

  const handleClear = useCallback(() => { setInput(""); setOutput(""); }, []);

  return (
    <div className="tool-panel">
      <h3 className="tool-title">Unicode 编解码</h3>
      <p className="tool-desc">将文本与 Unicode 转义序列（\uXXXX）互相转换</p>
      <TextArea className="tool-input" placeholder="在此输入文本或 \\u 转义序列..." value={input} onChange={(e) => setInput(e.target.value)} rows={6} spellCheck={false} />
      <div className="tool-actions">
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleEncode}>编码</Button>
        <Button icon={<ThunderboltOutlined />} onClick={handleDecode}>解码</Button>
        <Button icon={<CopyOutlined />} onClick={handleCopy}>复制</Button>
        <Button icon={<DeleteOutlined />} onClick={handleClear}>清空</Button>
      </div>
      <TextArea className="tool-output" value={output} readOnly placeholder="输出结果..." rows={6} spellCheck={false} />
    </div>
  );
};

export default UnicodeTool;

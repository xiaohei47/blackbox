import React, { useState, useCallback } from "react";
import { Input, Button, message } from "antd";
import {
  ThunderboltOutlined,
  CopyOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

const { TextArea } = Input;

function b64Encode(str: string): string {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    ));
  } catch {
    return btoa(str);
  }
}

function b64Decode(str: string): string {
  try {
    return decodeURIComponent(
      atob(str)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
  } catch {
    return atob(str);
  }
}

const Base64Tool: React.FC = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const handleEncode = useCallback(() => {
    if (!input) { message.warning("请输入内容"); return; }
    try { setOutput(b64Encode(input)); } catch { setOutput("编码失败：输入包含无法处理的字符"); }
  }, [input]);

  const handleDecode = useCallback(() => {
    if (!input) { message.warning("请输入内容"); return; }
    try { setOutput(b64Decode(input)); } catch { setOutput("解码失败：无效的 Base64 编码"); }
  }, [input]);

  const handleCopy = useCallback(async () => {
    if (!output) { message.warning("没有可复制的内容"); return; }
    try { await navigator.clipboard.writeText(output); message.success("已复制"); }
    catch { message.error("复制失败"); }
  }, [output]);

  const handleClear = useCallback(() => { setInput(""); setOutput(""); }, []);

  return (
    <div className="tool-panel">
      <h3 className="tool-title">Base64 编解码</h3>
      <TextArea className="tool-input" placeholder="在此输入文本或 Base64..." value={input} onChange={(e) => setInput(e.target.value)} rows={6} spellCheck={false} />
      <div className="tool-actions">
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleEncode}>编码</Button>
        <Button icon={<ThunderboltOutlined />} onClick={handleDecode}>解码</Button>
        <Button icon={<CopyOutlined />} onClick={handleCopy}>复制</Button>
        <Button icon={<DeleteOutlined />} onClick={handleClear}>清空</Button>
      </div>
      <TextArea className="tool-output" value={output} readOnly placeholder="输出结果..." rows={6} spellCheck={false} />
      {output && !output.startsWith("编") && !output.startsWith("解") && (
        <div className="tool-status">{new Blob([output]).size > 1024 ? (new Blob([output]).size / 1024).toFixed(1) + " KB" : new Blob([output]).size + " B"}</div>
      )}
    </div>
  );
};

export default Base64Tool;

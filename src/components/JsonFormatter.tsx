import React, { useState, useCallback } from "react";
import { Input, Button, message } from "antd";
import {
  ThunderboltOutlined,
  CompressOutlined,
  CopyOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import "./JsonFormatter.css";

const { TextArea } = Input;

const JsonFormatter: React.FC = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFormat = useCallback(() => {
    if (!input.trim()) {
      setError("请输入 JSON");
      setOutput("");
      return;
    }
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "格式错误";
      setError(msg);
      setOutput("");
    }
  }, [input]);

  const handleMinify = useCallback(() => {
    if (!input.trim()) {
      setError("请输入 JSON");
      setOutput("");
      return;
    }
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "格式错误";
      setError(msg);
      setOutput("");
    }
  }, [input]);

  const handleCopy = useCallback(async () => {
    if (!output) {
      message.warning("没有可复制的内容");
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      message.success("已复制到剪贴板");
    } catch {
      message.error("复制失败");
    }
  }, [output]);

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        handleFormat();
      }
    },
    [handleFormat],
  );

  return (
    <div className="json-formatter">
      <h3 className="json-formatter-title">JSON 格式化</h3>
      <p className="json-formatter-desc">
        粘贴 JSON 文本，格式化或压缩。快捷键：<kbd>Ctrl</kbd>+<kbd>Enter</kbd>
      </p>

      <TextArea
        className="json-input"
        placeholder="在此粘贴 JSON..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={8}
        spellCheck={false}
      />

      <div className="json-actions">
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleFormat}
        >
          格式化
        </Button>
        <Button icon={<CompressOutlined />} onClick={handleMinify}>
          压缩
        </Button>
        <Button icon={<CopyOutlined />} onClick={handleCopy}>
          复制
        </Button>
        <Button icon={<DeleteOutlined />} onClick={handleClear}>
          清空
        </Button>
      </div>

      <TextArea
        className="json-output"
        value={error ? "" : output}
        readOnly
        placeholder={error ? "" : "输出结果..."}
        rows={12}
        spellCheck={false}
      />

      {error && <div className="json-error">❌ {error}</div>}

      {!error && output && (
        <div className="json-status">
          ✅ 格式正确 —{" "}
          {new Blob([output]).size > 1024
            ? (new Blob([output]).size / 1024).toFixed(1) + " KB"
            : new Blob([output]).size + " B"}
        </div>
      )}
    </div>
  );
};

export default JsonFormatter;

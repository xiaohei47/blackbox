import React, { useCallback } from "react";
import { Input, Button, message } from "antd";
import {
  ThunderboltOutlined,
  CopyOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useToolState } from "../../hooks/useToolState";
import { errMsg } from "../../utils/bytes";

const { TextArea } = Input;

const HexTool: React.FC = () => {
  const { input, setInput, output, setOutput, handleCopy, handleClear } = useToolState();

  const handleEncode = useCallback(() => {
    if (!input) { message.warning("请输入内容"); return; }
    try {
      const bytes = new TextEncoder().encode(input);
      setOutput(Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" "));
    } catch (e) { setOutput("转换失败：" + errMsg(e)); }
  }, [input, setOutput]);

  const handleDecode = useCallback(() => {
    if (!input) { message.warning("请输入内容"); return; }
    try {
      const hex = input.replace(/\s+/g, "");
      if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
        setOutput("解码失败：无效的十六进制字符串");
        return;
      }
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
      setOutput(new TextDecoder().decode(bytes));
    } catch { setOutput("解码失败：无法解析为文本"); }
  }, [input, setOutput]);

  return (
    <div className="tool-panel">
      <h3 className="tool-title">Hex 编解码</h3>
      <TextArea className="tool-input" placeholder="在此输入文本或十六进制..." value={input} onChange={(e) => setInput(e.target.value)} rows={6} spellCheck={false} />
      <div className="tool-actions">
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleEncode}>文本 → Hex</Button>
        <Button icon={<ThunderboltOutlined />} onClick={handleDecode}>Hex → 文本</Button>
        <Button icon={<CopyOutlined />} onClick={handleCopy}>复制</Button>
        <Button icon={<DeleteOutlined />} onClick={handleClear}>清空</Button>
      </div>
      <TextArea className="tool-output" value={output} readOnly placeholder="输出结果..." rows={6} spellCheck={false} />
    </div>
  );
};

export default HexTool;

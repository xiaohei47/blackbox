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

const UrlTool: React.FC = () => {
  const { input, setInput, output, setOutput, handleCopy, handleClear } = useToolState();

  const handleEncode = useCallback(() => {
    if (!input) { message.warning("请输入内容"); return; }
    try { setOutput(encodeURIComponent(input)); } catch (e) { setOutput("编码失败：" + errMsg(e)); }
  }, [input, setOutput]);

  const handleDecode = useCallback(() => {
    if (!input) { message.warning("请输入内容"); return; }
    try { setOutput(decodeURIComponent(input)); } catch { setOutput("解码失败：无效的 URL 编码"); }
  }, [input, setOutput]);

  return (
    <div className="tool-panel">
      <h3 className="tool-title">URL 编解码</h3>
      <TextArea className="tool-input" placeholder="在此输入文本或 URL 编码..." value={input} onChange={(e) => setInput(e.target.value)} rows={6} spellCheck={false} />
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

export default UrlTool;

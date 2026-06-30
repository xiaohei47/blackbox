import React, { useState, useCallback, useRef, useEffect } from "react";
import { Input, Button, Select, message } from "antd";
import { CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import { useToolState } from "../../hooks/useToolState";
import { bytesToHex } from "../../utils/bytes";
import { md5 } from "./md5";

const { TextArea } = Input;

type Algo = "md5" | "sha1" | "sha256" | "sha384" | "sha512";

const ALGO_OPTIONS: { value: Algo; label: string }[] = [
  { value: "md5", label: "MD5" },
  { value: "sha1", label: "SHA1" },
  { value: "sha256", label: "SHA256" },
  { value: "sha384", label: "SHA384" },
  { value: "sha512", label: "SHA512" },
];

async function computeHash(algo: Algo, input: string): Promise<string> {
  if (algo === "md5") return md5(input);
  const name = algo.toUpperCase().replace("SHA", "SHA-");
  const buf = await crypto.subtle.digest(name, new TextEncoder().encode(input));
  return bytesToHex(buf);
}

const HashTool: React.FC = () => {
  const { input, setInput, output, setOutput, handleCopy, handleClear } = useToolState();
  const [algo, setAlgo] = useState<Algo>("md5");
  const [auto, setAuto] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const run = useCallback(async (val: string, a: Algo) => {
    if (!val) { setOutput(""); return; }
    try {
      const hash = await computeHash(a, val);
      setOutput(hash.toUpperCase());
    } catch {
      setOutput("计算失败");
    }
  }, []);

  // Auto-compute on input change
  useEffect(() => {
    if (!auto) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => run(input, algo), 300);
    return () => clearTimeout(timerRef.current);
  }, [input, algo, auto, run]);

  const handleCompute = useCallback(() => {
    if (!input) { message.warning("请输入内容"); return; }
    run(input, algo);
    setAuto(false);
    setTimeout(() => setAuto(true), 100);
  }, [input, algo, run]);

  // handleClear from useToolState

  return (
    <div className="tool-panel">
      <h3 className="tool-title">哈希计算</h3>

      <div className="tool-options">
        <label className="tool-opt-label">算法</label>
        <Select value={algo} onChange={setAlgo} style={{ width: 150 }} options={ALGO_OPTIONS} />
      </div>

      <TextArea className="tool-input" placeholder="在此输入要计算哈希的文本..." value={input} onChange={(e) => setInput(e.target.value)} rows={6} spellCheck={false} />

      <div className="tool-actions">
        <Button type="primary" onClick={handleCompute}>计算</Button>
        <Button icon={<CopyOutlined />} onClick={handleCopy}>复制</Button>
        <Button icon={<DeleteOutlined />} onClick={handleClear}>清空</Button>
      </div>

      <TextArea className="tool-output tool-output-hash" value={output} readOnly placeholder="哈希值..." rows={3} spellCheck={false} />
      {output && (
        <div className="tool-status">
          {algo.toUpperCase()} — {output.length / 2} 字节 / {(output.length / 2 * 8)} bits
        </div>
      )}
    </div>
  );
};

export default HashTool;

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Input, Button, Select, message } from "antd";
import { CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import { md5 } from "./md5";

const { TextArea } = Input;

type Algo = "md5" | "sha1" | "sha256" | "sha384" | "sha512";

const ALGO_OPTIONS: { value: Algo; label: string }[] = [
  { value: "md5", label: "HMAC-MD5" },
  { value: "sha1", label: "HMAC-SHA1" },
  { value: "sha256", label: "HMAC-SHA256" },
  { value: "sha384", label: "HMAC-SHA384" },
  { value: "sha512", label: "HMAC-SHA512" },
];

async function hmac(algo: Algo, key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  if (algo === "md5") {
    // HMAC-MD5 implementation
    const blockSize = 64;
    let k = enc.encode(key);
    if (k.length > blockSize) k = enc.encode(md5(key));
    const kPad = new Uint8Array(blockSize);
    kPad.set(k);
    const oKeyPad = new Uint8Array(blockSize);
    const iKeyPad = new Uint8Array(blockSize);
    for (let i = 0; i < blockSize; i++) {
      oKeyPad[i] = kPad[i] ^ 0x5c;
      iKeyPad[i] = kPad[i] ^ 0x36;
    }
    const inner = new Uint8Array([...iKeyPad, ...enc.encode(data)]);
    const innerHash = md5(String.fromCharCode(...inner));
    const outer = new Uint8Array([...oKeyPad, ...enc.encode(innerHash)]);
    return md5(String.fromCharCode(...outer)).toUpperCase();
  }

  const name = algo.toUpperCase().replace("SHA", "SHA-");
  const keyObj = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: name },
    false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", keyObj, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("").toUpperCase();
}

const HmacTool: React.FC = () => {
  const [input, setInput] = useState("");
  const [key, setKey] = useState("");
  const [output, setOutput] = useState("");
  const [algo, setAlgo] = useState<Algo>("sha256");
  const autoRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const run = useCallback(async (val: string, k: string, a: Algo) => {
    if (!val || !k) { setOutput(""); return; }
    try {
      setOutput(await hmac(a, k, val));
    } catch { setOutput("计算失败"); }
  }, []);

  useEffect(() => {
    clearTimeout(autoRef.current);
    autoRef.current = setTimeout(() => run(input, key, algo), 400);
    return () => clearTimeout(autoRef.current);
  }, [input, key, algo, run]);

  const handleCopy = useCallback(async () => {
    if (!output) { message.warning("没有可复制的内容"); return; }
    try { await navigator.clipboard.writeText(output); message.success("已复制"); }
    catch { message.error("复制失败"); }
  }, [output]);

  const handleClear = useCallback(() => { setInput(""); setKey(""); setOutput(""); }, []);

  return (
    <div className="tool-panel">
      <h3 className="tool-title">HMAC 签名</h3>
      <p className="tool-desc">使用密钥对文本进行 HMAC 签名，输入即自动计算</p>

      <div className="tool-options">
        <label className="tool-opt-label">算法</label>
        <Select value={algo} onChange={setAlgo} style={{ width: 180 }} options={ALGO_OPTIONS} />
      </div>

      <div className="tool-field">
        <label className="tool-opt-label">密钥</label>
        <Input.Password placeholder="输入密钥" value={key} onChange={(e) => setKey(e.target.value)} />
      </div>

      <TextArea className="tool-input" placeholder="在此输入要签名的文本..." value={input} onChange={(e) => setInput(e.target.value)} rows={6} spellCheck={false} />

      <div className="tool-actions">
        <Button icon={<CopyOutlined />} onClick={handleCopy}>复制</Button>
        <Button icon={<DeleteOutlined />} onClick={handleClear}>清空</Button>
      </div>

      <TextArea className="tool-output tool-output-hash" value={output} readOnly placeholder="HMAC 值..." rows={3} spellCheck={false} />
    </div>
  );
};

export default HmacTool;

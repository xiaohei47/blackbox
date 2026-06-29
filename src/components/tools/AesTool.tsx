import React, { useState, useCallback } from "react";
import { Input, Button, Select, message } from "antd";
import { CopyOutlined, DeleteOutlined } from "@ant-design/icons";

const { TextArea } = Input;

type Mode = "CBC" | "CTR" | "GCM";
type KeySize = 128 | 192 | 256;
type OutFormat = "base64" | "hex";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "CBC", label: "CBC" },
  { value: "CTR", label: "CTR" },
  { value: "GCM", label: "GCM" },
];

const KEYSIZE_OPTIONS: { value: KeySize; label: string }[] = [
  { value: 128, label: "128 位" },
  { value: 192, label: "192 位" },
  { value: 256, label: "256 位" },
];

const FORMAT_OPTIONS: { value: OutFormat; label: string }[] = [
  { value: "base64", label: "Base64" },
  { value: "hex", label: "Hex" },
];

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(s: string): Uint8Array {
  const h = s.replace(/\s/g, "");
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.substr(i * 2, 2), 16);
  }
  return bytes;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(s: string): Uint8Array {
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function formatOutput(buf: ArrayBuffer, fmt: OutFormat): string {
  return fmt === "hex" ? hex(buf) : toBase64(buf);
}



async function getKey(
  password: string,
  keySize: KeySize,
  mode: Mode,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(password));
  const raw = new Uint8Array(hash).slice(0, keySize / 8);

  let algo: AesKeyAlgorithm | Algorithm;
  if (mode === "GCM") {
    algo = { name: "AES-GCM" };
  } else if (mode === "CTR") {
    algo = { name: "AES-CTR" };
  } else {
    algo = { name: "AES-CBC" };
  }
  return crypto.subtle.importKey("raw", raw, algo, false, usage);
}

function getIv(mode: Mode, ivHex: string): Uint8Array {
  if (ivHex) {
    const iv = fromHex(ivHex);
    if (mode === "GCM" && iv.length !== 12) throw new Error("GCM 模式 IV 必须为 12 字节 (24 位十六进制)");
    if (mode === "CBC" && iv.length !== 16) throw new Error("CBC 模式 IV 必须为 16 字节 (32 位十六进制)");
    if (mode === "CTR" && iv.length !== 16) throw new Error("CTR 模式 IV 必须为 16 字节 (32 位十六进制)");
    return iv;
  }
  // Generate random IV
  if (mode === "GCM") return crypto.getRandomValues(new Uint8Array(12));
  return crypto.getRandomValues(new Uint8Array(16));
}

const AesTool: React.FC = () => {
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [iv, setIv] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<Mode>("CBC");
  const [keySize, setKeySize] = useState<KeySize>(256);
  const [outFormat, setOutFormat] = useState<OutFormat>("base64");

  const handleEncrypt = useCallback(async () => {
    if (!input) { message.warning("请输入要加密的内容"); return; }
    if (!password) { message.warning("请输入密码"); return; }
    try {
      const key = await getKey(password, keySize, mode, ["encrypt"]);
      const ivBytes = getIv(mode, iv);
      const enc = new TextEncoder();
      const data = enc.encode(input);

      let result: ArrayBuffer;
      if (mode === "GCM") {
        result = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBytes }, key, data);
      } else if (mode === "CTR") {
        result = await crypto.subtle.encrypt({ name: "AES-CTR", iv: ivBytes, counter: ivBytes, length: 64 }, key, data);
      } else {
        result = await crypto.subtle.encrypt({ name: "AES-CBC", iv: ivBytes }, key, data);
      }

      const ivHex = hex(ivBytes.buffer);
      setOutput(`IV: ${ivHex}\n数据: ${formatOutput(result, outFormat)}`);
    } catch (e) {
      setOutput("加密失败：" + (e instanceof Error ? e.message : String(e)));
    }
  }, [input, password, iv, mode, keySize, outFormat]);

  const handleDecrypt = useCallback(async () => {
    if (!input) { message.warning("请输入要解密的内容"); return; }
    if (!password) { message.warning("请输入密码"); return; }
    try {
      // Parse input - might be in format "IV: ...\n数据: ..." or just raw data
      let ivHex = iv;
      let cipherText = input;
      const ivMatch = input.match(/^IV:\s*([0-9a-fA-F]+)/);
      if (ivMatch) {
        ivHex = ivMatch[1];
        cipherText = input.replace(/^IV:\s*[0-9a-fA-F]+\s*\n?(数据:\s*)?/i, "").trim();
      }
      if (!ivHex) { message.warning("请提供 IV"); return; }

      const key = await getKey(password, keySize, mode, ["decrypt"]);
      const ivBytes = fromHex(ivHex);
      const data = outFormat === "hex" ? fromHex(cipherText) : fromBase64(cipherText);

      let plain: ArrayBuffer;
      if (mode === "GCM") {
        plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, data);
      } else if (mode === "CTR") {
        plain = await crypto.subtle.decrypt({ name: "AES-CTR", iv: ivBytes, counter: ivBytes, length: 64 }, key, data);
      } else {
        plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv: ivBytes }, key, data);
      }

      setOutput(new TextDecoder().decode(plain));
    } catch {
      setOutput("解密失败：请检查密码、IV 和密文是否正确");
    }
  }, [input, password, iv, mode, keySize, outFormat]);

  const handleCopy = useCallback(async () => {
    if (!output) { message.warning("没有可复制的内容"); return; }
    try { await navigator.clipboard.writeText(output); message.success("已复制"); }
    catch { message.error("复制失败"); }
  }, [output]);

  const handleClear = useCallback(() => { setInput(""); setOutput(""); }, []);

  return (
    <div className="tool-panel">
      <h3 className="tool-title">AES 加密/解密</h3>
      <p className="tool-desc">使用 AES 算法加密或解密文本，支持 CBC / CTR / GCM 模式</p>

      <div className="tool-options-row">
        <div className="tool-options">
          <label className="tool-opt-label">模式</label>
          <Select value={mode} onChange={setMode} style={{ width: 100 }} options={MODE_OPTIONS} />
        </div>
        <div className="tool-options">
          <label className="tool-opt-label">密钥长度</label>
          <Select value={keySize} onChange={setKeySize} style={{ width: 100 }} options={KEYSIZE_OPTIONS} />
        </div>
        <div className="tool-options">
          <label className="tool-opt-label">输出格式</label>
          <Select value={outFormat} onChange={setOutFormat} style={{ width: 100 }} options={FORMAT_OPTIONS} />
        </div>
      </div>

      <div className="tool-field">
        <label className="tool-opt-label">密码</label>
        <Input.Password placeholder="输入加密密码" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="tool-field">
        <label className="tool-opt-label">IV（十六进制，留空自动生成）</label>
        <Input placeholder="例如 00112233445566778899AABBCCDDEEFF" value={iv} onChange={(e) => setIv(e.target.value)} />
      </div>

      <TextArea className="tool-input" placeholder="加密：输入明文&#10;解密：输入密文（或粘贴加密结果全文）" value={input} onChange={(e) => setInput(e.target.value)} rows={5} spellCheck={false} />

      <div className="tool-actions">
        <Button type="primary" onClick={handleEncrypt}>加密</Button>
        <Button onClick={handleDecrypt}>解密</Button>
        <Button icon={<CopyOutlined />} onClick={handleCopy}>复制</Button>
        <Button icon={<DeleteOutlined />} onClick={handleClear}>清空</Button>
      </div>

      <TextArea className="tool-output" value={output} readOnly placeholder="输出结果..." rows={5} spellCheck={false} />
    </div>
  );
};

export default AesTool;

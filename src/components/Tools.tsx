import React, { useState } from "react";
import {
  CodeOutlined,
  BgColorsOutlined,
  LinkOutlined,
  NumberOutlined,
  KeyOutlined,
  SafetyOutlined,
  LockOutlined,
} from "@ant-design/icons";
import DiffTool from "./tools/DiffTool";
import Base64Tool from "./tools/Base64Tool";
import UrlTool from "./tools/UrlTool";
import HexTool from "./tools/HexTool";
import UnicodeTool from "./tools/UnicodeTool";
import HashTool from "./tools/HashTool";
import HmacTool from "./tools/HmacTool";
import AesTool from "./tools/AesTool";
import "./tools/ToolStyles.css";
import "./Tools.css";

interface ToolCategory {
  label: string;
  items: { key: string; icon: React.ReactNode; label: string }[];
}

const toolCategories: ToolCategory[] = [
  {
    label: "常用工具",
    items: [
      { key: "diff", icon: <CodeOutlined />, label: "代码工具" },
    ],
  },
  {
    label: "编解码",
    items: [
      { key: "base64", icon: <BgColorsOutlined />, label: "Base64" },
      { key: "url", icon: <LinkOutlined />, label: "URL" },
      { key: "hex", icon: <NumberOutlined />, label: "Hex" },
      { key: "unicode", icon: <CodeOutlined />, label: "Unicode" },
    ],
  },
  {
    label: "加解密/签名",
    items: [
      { key: "hash", icon: <KeyOutlined />, label: "哈希" },
      { key: "hmac", icon: <SafetyOutlined />, label: "HMAC" },
      { key: "aes", icon: <LockOutlined />, label: "AES" },
    ],
  },
];

const Tools: React.FC = () => {
  const [activeKey, setActiveKey] = useState("diff");

  return (
    <div className="tools-layout">
      <aside className="tools-nav">
        <div className="tools-nav-list">
          {toolCategories.map((cat) => (
            <React.Fragment key={cat.label}>
              <div className="tools-nav-category">{cat.label}</div>
              {cat.items.map((item) => (
                <button
                  key={item.key}
                  className={`tools-nav-item${item.key === activeKey ? " active" : ""}`}
                  onClick={() => setActiveKey(item.key)}
                >
                  <span className="tools-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>
      </aside>

      <main className="tools-content">
        {activeKey === "diff" && <DiffTool />}
        {activeKey === "base64" && <Base64Tool />}
        {activeKey === "url" && <UrlTool />}
        {activeKey === "hex" && <HexTool />}
        {activeKey === "unicode" && <UnicodeTool />}
        {activeKey === "hash" && <HashTool />}
        {activeKey === "hmac" && <HmacTool />}
        {activeKey === "aes" && <AesTool />}
      </main>
    </div>
  );
};

export default Tools;

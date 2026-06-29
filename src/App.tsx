import React, { useState } from "react";
import { Layout } from "antd";
import {
  EditOutlined,
  ToolOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import Notes from "./components/Notes";
import Tools from "./components/Tools";
import Settings from "./components/Settings";

const { Content } = Layout;

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
}

const navItems: MenuItem[] = [
  { key: "notes", icon: <EditOutlined />, label: "笔记" },
  { key: "tools", icon: <ToolOutlined />, label: "工具" },
];

const App: React.FC = () => {
  const [current, setCurrent] = useState("notes");

  return (
    <Layout className="app-layout">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <span className="brand-dot" />
            <span>小黑百宝箱</span>
          </div>
          <nav className="topbar-nav">
            {navItems.map((item) => {
              const active = item.key === current;
              return (
                <button
                  key={item.key}
                  className={`topbar-item${active ? " active" : ""}`}
                  onClick={() => setCurrent(item.key)}
                >
                  <span className="topbar-item-icon">{item.icon}</span>
                  <span className="topbar-item-label">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="topbar-actions">
            <button
              className={`topbar-item${current === "settings" ? " active" : ""}`}
              onClick={() => setCurrent("settings")}
            >
              <span className="topbar-item-icon"><SettingOutlined /></span>
              <span className="topbar-item-label">设置</span>
            </button>
            <span className="topbar-time">
              {new Date().toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </header>

      <Content className="app-content">
        {current === "notes" ? (
          <Notes />
        ) : current === "tools" ? (
          <Tools />
        ) : (
          <Settings />
        )}
      </Content>
    </Layout>
  );
};

export default App;

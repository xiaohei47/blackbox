import React, { useState, useCallback } from "react";
import { Layout } from "antd";
import {
  EditOutlined,
  ToolOutlined,
  SettingOutlined,
  StarFilled,
} from "@ant-design/icons";
import Notes from "./components/Notes";
import Tools from "./components/Tools";
import Settings from "./components/Settings";

const { Content } = Layout;

const PARTICLE_COLORS = ["#667eea", "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6b9d"];

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  size: number;
}

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
  const [particles, setParticles] = useState<Particle[]>([]);

  const handleStarClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 10 + Math.floor(Math.random() * 6);
    const p: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist = 40 + Math.random() * 80;
      p.push({
        id: Date.now() + i,
        x: cx,
        y: cy,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        size: 4 + Math.random() * 4,
      });
    }
    setParticles(p);
    setTimeout(() => setParticles([]), 800);
  }, []);

  return (
    <Layout className="app-layout">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <span className="star-wrapper" onClick={handleStarClick}>
              <StarFilled style={{ color: "#667eea", fontSize: 14 }} />
              {particles.map((p) => (
                <span
                  key={p.id}
                  className="star-particle"
                  style={{
                    left: p.x,
                    top: p.y,
                    width: p.size,
                    height: p.size,
                    background: p.color,
                    "--dx": `${p.dx}px`,
                    "--dy": `${p.dy}px`,
                  } as React.CSSProperties}
                />
              ))}
            </span>
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

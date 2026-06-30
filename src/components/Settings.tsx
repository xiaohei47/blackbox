import React, { useState, useEffect } from "react";
import {
  Input,
  Button,
  Select,
  Typography,
  message,
  Alert,
  Switch,
  Tooltip,
} from "antd";
import {
  EditOutlined,
  SyncOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import type { WebdavConfig } from "../settings-store";
import {
  getSyncConfig,
  setSyncConfig,
  setLastSyncAt,
  type SyncConfig,
} from "../settings-store";
import { testWebdavConnection, syncWithWebdav } from "../webdav-sync";
import { getAutoSave, setAutoSave } from "../settings-repo";
import "./Settings.css";

const { Text } = Typography;

interface SettingsCategory {
  key: string;
  icon: React.ReactNode;
  label: string;
}

const categories: SettingsCategory[] = [
  { key: "note", icon: <EditOutlined />, label: "笔记设置" },
];

const AppSettings: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState("note");
  const [syncConfig, setSyncConfigState] = useState<SyncConfig | null>(null);
  const [autoSave, setAutoSaveState] = useState(true);
  const [webdavUrl, setWebdavUrl] = useState("");
  const [webdavUser, setWebdavUser] = useState("");
  const [webdavPass, setWebdavPass] = useState("");
  const [syncMethod, setSyncMethod] = useState("webdav");
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncDisplay, setLastSyncDisplay] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "ok" | "fail"
  >("idle");

  // Load configs on mount
  useEffect(() => {
    getAutoSave().then(setAutoSaveState);
    getSyncConfig().then((cfg) => {
      setSyncConfigState(cfg);
      setSyncMethod(cfg.method);
      setWebdavUrl(cfg.webdav.url);
      setWebdavUser(cfg.webdav.username);
      setWebdavPass(cfg.webdav.password);
      setLastSyncDisplay(cfg.lastSyncAt);
    });
  }, []);

  const handleSaveConfig = async () => {
    if (!syncConfig) return;
    const newCfg: SyncConfig = {
      ...syncConfig,
      method: syncMethod,
      webdav: { url: webdavUrl, username: webdavUser, password: webdavPass },
    };
    await setSyncConfig(newCfg);
    setSyncConfigState(newCfg);
    message.success("配置已保存");
  };

  const handleTestConnection = async () => {
    if (!webdavUrl.trim() || !webdavUser.trim()) {
      message.warning("请先填写服务器地址和用户名");
      return;
    }
    setTesting(true);
    setConnectionStatus("idle");
    const result = await testWebdavConnection({
      url: webdavUrl,
      username: webdavUser,
      password: webdavPass,
    });
    setConnectionStatus(result.ok ? "ok" : "fail");
    if (result.ok) {
      message.success(result.message);
    } else {
      message.error(result.message);
    }
    setTesting(false);
  };

  const handleSync = async () => {
    if (!webdavUrl.trim() || !webdavUser.trim()) {
      message.warning("请先填写 WebDAV 配置");
      return;
    }
    // Save first
    await handleSaveConfig();

    setSyncing(true);
    const wc: WebdavConfig = {
      url: webdavUrl,
      username: webdavUser,
      password: webdavPass,
    };
    const result = await syncWithWebdav(wc);
    setSyncing(false);

    if (result.success) {
      setLastSyncDisplay(result.syncedAt);
      await setLastSyncAt(result.syncedAt);
      message.success(
        `同步完成！上传 ${result.pushed} 项，下载 ${result.pulled} 项`,
      );
    } else {
      message.error(`同步失败: ${result.error}`);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "从未同步";
    try {
      return new Date(iso).toLocaleString("zh-CN");
    } catch {
      return iso;
    }
  };

  const handleAutoSaveToggle = async (val: boolean) => {
    setAutoSaveState(val);
    await setAutoSave(val);
  };

  return (
    <div className="settings-layout">
      {/* Left category nav */}
      <aside className="settings-nav">
        <div className="settings-nav-list">
          {categories.map((cat) => (
            <button
              key={cat.key}
              className={`settings-nav-item${cat.key === activeCategory ? " active" : ""}`}
              onClick={() => setActiveCategory(cat.key)}
            >
              <span className="settings-nav-icon">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Content */}
      <main className="settings-content">
        {activeCategory === "note" && (
          <>
            <div className="settings-section">
              <div className="settings-field">
                <label className="settings-label">
                  自动保存
                  <Tooltip title="关闭后需按 Ctrl+S 手动保存笔记">
                    <QuestionCircleOutlined className="settings-label-tip" />
                  </Tooltip>
                </label>
                <div><Switch checked={autoSave} onChange={handleAutoSaveToggle} /></div>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-field">
                <label className="settings-label">
                  同步方式
                  <Tooltip title="选择同步方式并将笔记数据同步到远程服务器">
                    <QuestionCircleOutlined className="settings-label-tip" />
                  </Tooltip>
                </label>
                <Select
                  value={syncMethod}
                  onChange={setSyncMethod}
                  style={{ width: 240 }}
                  options={[
                    { value: "webdav", label: "WebDAV" },
                    { value: "none", label: "关闭同步" },
                  ]}
                />
              </div>

              {syncMethod === "webdav" && (
            <div className="settings-webdav">
              <div className="settings-field">
                <label className="settings-label">服务器地址</label>
                <Input
                  placeholder="https://example.com/remote.php/dav/files/user/"
                  value={webdavUrl}
                  onChange={(e) => setWebdavUrl(e.target.value)}
                />
              </div>

              <div className="settings-field">
                <label className="settings-label">用户名</label>
                <Input
                  placeholder="用户名"
                  value={webdavUser}
                  onChange={(e) => setWebdavUser(e.target.value)}
                />
              </div>

              <div className="settings-field">
                <label className="settings-label">密码</label>
                <Input.Password
                  placeholder="密码"
                  value={webdavPass}
                  onChange={(e) => setWebdavPass(e.target.value)}
                />
              </div>

              <div className="settings-actions">
                <Button
                  onClick={handleTestConnection}
                  loading={testing}
                  icon={<CloudServerOutlined />}
                >
                  测试连接
                </Button>
                <Button
                  type="primary"
                  onClick={handleSync}
                  loading={syncing}
                  icon={<SyncOutlined />}
                >
                  立即同步
                </Button>
              </div>

              {connectionStatus !== "idle" && (
                <Alert
                  className="settings-alert"
                  type={connectionStatus === "ok" ? "success" : "error"}
                  showIcon
                  icon={
                    connectionStatus === "ok" ? (
                      <CheckCircleOutlined />
                    ) : (
                      <CloseCircleOutlined />
                    )
                  }
                  message={
                    connectionStatus === "ok"
                      ? "服务器连接正常"
                      : "连接测试失败，请检查配置"
                  }
                />
              )}

              <div className="settings-last-sync">
                <Text type="secondary">
                  上次同步：{formatTime(lastSyncDisplay)}
                </Text>
              </div>
            </div>
          )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AppSettings;

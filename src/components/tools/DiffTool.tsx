import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button, Select, Segmented, Statistic, message } from "antd";
import { DeleteOutlined, ThunderboltOutlined, CompressOutlined, ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import "./DiffTool.css";

// Lazy-load Monaco editor components (code-split from main bundle)
const Editor = React.lazy(async () => {
  const m = await import("@monaco-editor/react");
  return { default: m.Editor as React.ComponentType<any> };
});

const DiffEditor = React.lazy(async () => {
  const m = await import("@monaco-editor/react");
  return { default: m.DiffEditor as React.ComponentType<any> };
});

type Lang = "plaintext" | "json" | "javascript" | "typescript" | "python" | "go" | "rust" | "html" | "css" | "xml" | "yaml" | "markdown" | "sql" | "java" | "c" | "cpp";
type Mode = "format" | "diff";

const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: "plaintext", label: "纯文本" },
  { value: "json", label: "JSON" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "sql", label: "SQL" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
];

function defineAppThemes() {
  // @ts-ignore
  const monaco = (window as any).monaco;
  if (!monaco) return;

  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const bg = isDark ? "#1c1c1e" : "#ffffff";
  const lineFg = isDark ? "#636366" : "#c7c7cc";
  const lineActive = isDark ? "#98989d" : "#8e8e93";
  const selectionBg = isDark ? "#2a5c8a" : "#add6ff";
  const scrollbarBg = isDark ? "#ffffff20" : "#00000010";
  const scrollbarHover = isDark ? "#ffffff30" : "#00000020";
  const scrollbarActive = isDark ? "#ffffff40" : "#00000030";

  monaco.editor.defineTheme("app", {
    base: isDark ? "vs-dark" : "vs",
    inherit: true,
    colors: {
      "editor.background": bg,
      "editorLineNumber.foreground": lineFg,
      "editorLineNumber.activeForeground": lineActive,
      "editor.selectionBackground": selectionBg,
      "editor.inactiveSelectionBackground": selectionBg + "55",
      "diffEditor.insertedTextBackground": "#34c75920",
      "diffEditor.removedTextBackground": "#ff3b3020",
      "diffEditor.insertedLineBackground": "#34c75910",
      "diffEditor.removedLineBackground": "#ff3b3010",
      "diffEditor.border": isDark ? "#3a3a3c" : "#d1d1d6",
      "scrollbar.shadow": "#0000",
      "scrollbarSlider.background": scrollbarBg,
      "scrollbarSlider.hoverBackground": scrollbarHover,
      "scrollbarSlider.activeBackground": scrollbarActive,
    },
    rules: [],
  });

  monaco.editor.setTheme("app");
}

const DiffTool: React.FC = () => {
  const [mode, setMode] = useState<Mode>("diff");
  const [code, setCode] = useState(""); // single-editor content (format mode)
  const [lang, setLang] = useState<Lang>("plaintext"); // diff mode
  const [fmtLang, setFmtLang] = useState<Lang>("json"); // format mode
  const [diffTotal, setDiffTotal] = useState(0);
  const diffEditorRef = useRef<any>(null);
  const formatEditorRef = useRef<any>(null);

  // ── Capture diff editor instance & set up model listeners ──
  const handleDiffMount = useCallback((editor: any) => {
    diffEditorRef.current = editor;

    // Listen for diff computation → update count
    editor.onDidUpdateDiff(() => {
      const changes = editor.getLineChanges();
      setDiffTotal(changes?.length ?? 0);
    });

    // Initial count
    const initialChanges = editor.getLineChanges?.() ?? [];
    setDiffTotal(initialChanges.length ?? 0);
  }, []);

  // ── Capture format editor instance ──
  const handleFormatMount = useCallback((editor: any) => {
    formatEditorRef.current = editor;
  }, []);

  // ── Update diff count when mode switches back to diff ──
  useEffect(() => {
    if (mode !== "diff") return;
    const editor = diffEditorRef.current;
    if (!editor) return;
    const changes = editor.getLineChanges?.();
    setDiffTotal(changes?.length ?? 0);
  }, [mode]);

  // ── Diff navigation (manual, based on getLineChanges) ──
  const handlePrevDiff = useCallback(() => {
    const editor = diffEditorRef.current;
    if (!editor) return;
    const changes = editor.getLineChanges?.();
    if (!changes || changes.length === 0) return;

    const modEditor = editor.getModifiedEditor();
    const pos = modEditor.getPosition();
    const cur = pos?.lineNumber ?? 1;

    // Find previous change: largest modifiedStartLineNumber < cur
    let target = changes[changes.length - 1].modifiedStartLineNumber; // wrap to last
    for (let i = changes.length - 1; i >= 0; i--) {
      if (changes[i].modifiedStartLineNumber < cur) {
        target = changes[i].modifiedStartLineNumber;
        break;
      }
    }

    modEditor.revealLineInCenter(target);
    modEditor.setPosition({ lineNumber: target, column: 1 });
    modEditor.focus();
  }, []);

  const handleNextDiff = useCallback(() => {
    const editor = diffEditorRef.current;
    if (!editor) return;
    const changes = editor.getLineChanges?.();
    if (!changes || changes.length === 0) return;

    const modEditor = editor.getModifiedEditor();
    const pos = modEditor.getPosition();
    const cur = pos?.lineNumber ?? 1;

    // Find next change: smallest modifiedStartLineNumber > cur
    let target = changes[0].modifiedStartLineNumber; // wrap to first
    for (const ch of changes) {
      if (ch.modifiedStartLineNumber > cur) {
        target = ch.modifiedStartLineNumber;
        break;
      }
    }

    modEditor.revealLineInCenter(target);
    modEditor.setPosition({ lineNumber: target, column: 1 });
    modEditor.focus();
  }, []);

  // ── Define Monaco theme once it's loaded ──
  useEffect(() => {
    let attempts = 0;
    const id = setInterval(() => {
      // @ts-ignore
      if ((window as any).monaco?.editor) {
        defineAppThemes();
        clearInterval(id);
      }
      if (++attempts > 50) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ── Follow system dark mode ──
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      // @ts-ignore
      const monaco = (window as any).monaco?.editor;
      if (!monaco) return;
      defineAppThemes();
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Handlers ──
  const handleClear = useCallback(() => {
    if (mode === "format") {
      setCode("");
    } else {
      const editor = diffEditorRef.current;
      if (!editor) return;
      editor.getOriginalEditor().getModel()?.setValue("");
      editor.getModifiedEditor().getModel()?.setValue("");
    }
  }, [mode]);

  const handleFormatCode = useCallback(() => {
    if (!code.trim()) { message.warning("请输入内容"); return; }
    // JSON: use JSON.parse/stringify (indented)
    if (fmtLang === "json") {
      try {
        const parsed = JSON.parse(code);
        setCode(JSON.stringify(parsed, null, 2));
      } catch { message.error("JSON 格式错误"); }
      return;
    }
    // Other languages: use Monaco's built-in formatter
    const editor = formatEditorRef.current;
    if (!editor) { message.warning("编辑器尚未就绪"); return; }
    editor.getAction('editor.action.formatDocument')?.run();
  }, [code, fmtLang]);

  const handleMinifyJson = useCallback(() => {
    if (!code.trim()) { message.warning("请输入 JSON"); return; }
    try {
      const parsed = JSON.parse(code);
      setCode(JSON.stringify(parsed));
    } catch { message.error("JSON 格式错误"); }
  }, [code]);

  const monacoOptions = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    lineNumbers: "on" as const,
    folding: false,
    wordWrap: "on" as const,
    automaticLayout: true,
    scrollbar: {
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6,
    },
    overviewRulerBorder: false,
    overviewRulerLanes: 0,
    lineNumbersMinChars: 1,
  };

  return (
    <div className="diff-tool">

      {/* ── Mode tabs ── */}
      <Segmented
        className="diff-mode-tabs"
        value={mode}
        onChange={(v) => setMode(v as Mode)}
        options={[
          { value: "format", label: "格式化" },
          { value: "diff", label: "对比" },
        ]}
      />

      {/* ── Toolbar ── */}
      {mode === "diff" ? (
        <div className="diff-toolbar">
          <Select
            value={lang}
            onChange={setLang}
            style={{ width: 140 }}
            options={LANG_OPTIONS}
            size="small"
          />
          <div className="diff-toolbar-actions">
            {diffTotal > 0 && (
              <Statistic className="diff-count" value={diffTotal} suffix="处差异" valueStyle={{ fontSize: 14 }} />
            )}
            <Button size="small" icon={<ArrowUpOutlined />} onClick={handlePrevDiff}>
              上一处
            </Button>
            <Button size="small" icon={<ArrowDownOutlined />} onClick={handleNextDiff}>
              下一处
            </Button>
            <Button size="small" icon={<DeleteOutlined />} onClick={handleClear}>
              清空
            </Button>
          </div>
        </div>
      ) : (
        <div className="diff-toolbar">
          <Select
            value={fmtLang}
            onChange={setFmtLang}
            style={{ width: 140 }}
            options={LANG_OPTIONS}
            size="small"
          />
          <div className="diff-toolbar-actions">
            <Button size="small" icon={<ThunderboltOutlined />} onClick={handleFormatCode}>
              格式化
            </Button>
            <Button size="small" icon={<CompressOutlined />} onClick={handleMinifyJson}>
              压缩
            </Button>
            <Button size="small" icon={<DeleteOutlined />} onClick={handleClear}>
              清空
            </Button>
          </div>
        </div>
      )}

      {/* ── Editor area ── */}
      <div className="diff-editor-container">
        <React.Suspense fallback={<div className="diff-loading">编辑器加载中...</div>}>
          {/* Keep both editors mounted but hide with CSS — prevents Monaco model-dispose race */}
          <div
            className={"diff-editor-pane" + (mode !== "diff" ? " hidden" : "")}
          >
            <DiffEditor
              language={lang}
              theme="app"
              onMount={handleDiffMount}
              options={{
                ...monacoOptions,
                renderSideBySide: true,
                readOnly: false,
                originalEditable: true,
                renderIndicators: true,
                enableSplitViewResizing: false,
                renderOverviewRuler: false,
              }}
            />
          </div>
          <div
            className={"diff-editor-pane" + (mode !== "format" ? " hidden" : "")}
          >
            <Editor
              value={code}
              onChange={(v: string | undefined) => setCode(v ?? "")}
              language={fmtLang}
              theme="app"
              onMount={handleFormatMount}
              options={{
                ...monacoOptions,
                readOnly: false,
              }}
            />
          </div>
        </React.Suspense>
      </div>
    </div>
  );
};

export default DiffTool;

import React, { useState, useEffect, useRef } from "react";
import { toggleList } from "@platejs/list";
import { toggleCodeBlock } from "@platejs/code-block";
import { formatCodeBlock } from "@platejs/code-block";
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  CommentOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  MinusOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

const LANGUAGES = [
  "plaintext", "javascript", "typescript", "html", "css", "json",
  "python", "java", "c", "cpp", "csharp", "go", "rust", "swift",
  "kotlin", "php", "ruby", "sql", "bash", "yaml", "xml", "markdown",
];

interface Props {
  editor: any;
  activeMarks: ReadonlySet<string>;
  activeBlock: string;
}

function getCodeBlockLang(editor: any): string {
  try {
    const entry = editor.api.block();
    if (entry && entry[0].type === "code_block") return entry[0].lang || "plaintext";
    const above = editor.api.above({ match: (n: any) => n.type === "code_block" });
    if (above) return above[0].lang || "plaintext";
  } catch {}
  return "plaintext";
}

/* ── Component ── */

const FixedToolbar: React.FC<Props> = ({ editor, activeMarks, activeBlock }) => {
  const toggleMark = (mark: string) => {
    editor.tf.toggleMark(mark);
  };

  const toggleBlock = (type: string) => {
    editor.tf.toggleBlock(type);
  };

  const handleList = (style: "ul" | "ol") => {
    toggleList(editor, { listStyleType: style });
  };

  const handleCodeBlock = () => {
    toggleCodeBlock(editor);
  };

  const handleHR = () => {
    editor.tf.insertNodes([{ type: "hr", children: [{ text: "" }] }]);
  };

  const handleFormat = () => {
    formatCodeBlock(editor, { element: editor.api.block()?.[0] });
  };

  const isCodeBlock = activeBlock === "code_block";
  const isList = activeBlock === "ul" || activeBlock === "ol";

  // ── Language selector state ──
  const [langOpen, setLangOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("plaintext");
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCodeBlock) setCurrentLang(getCodeBlockLang(editor));
  }, [isCodeBlock, editor, activeMarks]);

  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [langOpen]);

  const handleLangSelect = (lang: string) => {
    try {
      const entry = editor.api.block();
      if (entry && entry[0].type === "code_block") {
        editor.tf.setNodes({ lang }, { at: entry[1] });
      } else {
        const above = editor.api.above({ match: (n: any) => n.type === "code_block" });
        if (above) editor.tf.setNodes({ lang }, { at: above[1] });
      }
    } catch {}
    setCurrentLang(lang);
    setLangOpen(false);
  };

  return (
    <div className="fixed-toolbar" onMouseDown={(e) => e.preventDefault()}>
      {/* ── Inline marks ── */}
      <button
        className={"fixed-toolbar-btn icon-btn" + (activeMarks.has("bold") ? " active" : "")}
        onClick={() => toggleMark("bold")}
        title="加粗"
      >
        <BoldOutlined />
      </button>
      <button
        className={"fixed-toolbar-btn icon-btn" + (activeMarks.has("italic") ? " active" : "")}
        onClick={() => toggleMark("italic")}
        title="斜体"
      >
        <ItalicOutlined />
      </button>
      <button
        className={"fixed-toolbar-btn icon-btn" + (activeMarks.has("underline") ? " active" : "")}
        onClick={() => toggleMark("underline")}
        title="下划线"
      >
        <UnderlineOutlined />
      </button>
      <button
        className={"fixed-toolbar-btn icon-btn" + (activeMarks.has("strikethrough") ? " active" : "")}
        onClick={() => toggleMark("strikethrough")}
        title="删除线"
      >
        <StrikethroughOutlined />
      </button>
      <button
        className={"fixed-toolbar-btn icon-btn" + (activeMarks.has("code") ? " active" : "")}
        onClick={() => toggleMark("code")}
        title="行内代码"
      >
        <CodeOutlined />
      </button>

      <div className="fixed-toolbar-divider" />

      {/* ── Headings ── */}
      <button
        className={"fixed-toolbar-btn" + (activeBlock === "h1" ? " active" : "")}
        onClick={() => toggleBlock("h1")}
        title="标题 1"
      >
        <span style={{ fontWeight: 700, fontSize: 14 }}>H1</span>
      </button>
      <button
        className={"fixed-toolbar-btn" + (activeBlock === "h2" ? " active" : "")}
        onClick={() => toggleBlock("h2")}
        title="标题 2"
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>H2</span>
      </button>
      <button
        className={"fixed-toolbar-btn" + (activeBlock === "h3" ? " active" : "")}
        onClick={() => toggleBlock("h3")}
        title="标题 3"
      >
        <span style={{ fontWeight: 600, fontSize: 12 }}>H3</span>
      </button>
      <button
        className={"fixed-toolbar-btn" + (activeBlock === "h4" ? " active" : "")}
        onClick={() => toggleBlock("h4")}
        title="标题 4"
      >
        <span style={{ fontWeight: 600, fontSize: 11 }}>H4</span>
      </button>

      <div className="fixed-toolbar-divider" />

      {/* ── Blocks ── */}
      <button
        className={"fixed-toolbar-btn" + (activeBlock === "blockquote" ? " active" : "")}
        onClick={() => toggleBlock("blockquote")}
        title="引用"
      >
        <CommentOutlined />
      </button>
      <button
        className={"fixed-toolbar-btn" + (isList && activeBlock === "ul" ? " active" : "")}
        onClick={() => handleList("ul")}
        title="无序列表"
      >
        <UnorderedListOutlined />
      </button>
      <button
        className={"fixed-toolbar-btn" + (isList && activeBlock === "ol" ? " active" : "")}
        onClick={() => handleList("ol")}
        title="有序列表"
      >
        <OrderedListOutlined />
      </button>
      <button
        className={"fixed-toolbar-btn" + (isCodeBlock ? " active" : "")}
        onClick={handleCodeBlock}
        title="代码块"
      >
        <CodeOutlined />
      </button>

      {isCodeBlock && (
        <>
          <div className="fixed-toolbar-divider" />
          {/* ── Language selector ── */}
          <div className="fixed-toolbar-lang" ref={langRef}>
            <button
              className="fixed-toolbar-btn lang-btn"
              onClick={() => setLangOpen((v) => !v)}
              title="选择语言"
            >
              <span className="lang-label">{currentLang}</span>
              <span className="lang-arrow">▼</span>
            </button>
            {langOpen && (
              <div className="lang-dropdown">
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    className={"lang-option" + (l === currentLang ? " active" : "")}
                    onClick={() => handleLangSelect(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* ── Format button ── */}
          <button
            className="fixed-toolbar-btn icon-btn"
            onClick={handleFormat}
            title="格式化代码"
          >
            <ThunderboltOutlined />
          </button>
        </>
      )}

      <button
        className="fixed-toolbar-btn"
        onClick={handleHR}
        title="水平线"
      >
        <MinusOutlined />
      </button>
    </div>
  );
};

export default FixedToolbar;

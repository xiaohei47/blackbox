import React from "react";
import { toggleList } from "@platejs/list";
import { toggleCodeBlock } from "@platejs/code-block";
interface Props {
  editor: any;
  activeMarks: ReadonlySet<string>;
  activeBlock: string;
}

/* ── Simple icon components (no external deps) ── */

const BIcons = {
  Bold: () => <strong style={{ fontFamily: "inherit" }}>B</strong>,
  Italic: () => <em style={{ fontFamily: "inherit" }}>I</em>,
  Underline: () => <u style={{ fontFamily: "inherit" }}>U</u>,
  Strike: () => <s style={{ fontFamily: "inherit" }}>S</s>,
  Code: () => (
    <span style={{ fontFamily: "monospace", fontSize: 13 }}>{"</>"}</span>
  ),
  H1: () => <span style={{ fontWeight: 700, fontSize: 14 }}>H1</span>,
  H2: () => <span style={{ fontWeight: 600, fontSize: 13 }}>H2</span>,
  H3: () => <span style={{ fontWeight: 600, fontSize: 12 }}>H3</span>,
  H4: () => <span style={{ fontWeight: 600, fontSize: 11 }}>H4</span>,
  Quote: () => (
    <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "Georgia" }}>
      "
    </span>
  ),
  UL: () => <span style={{ fontSize: 13 }}>≡</span>,
  OL: () => <span style={{ fontSize: 13, fontWeight: 600 }}>#</span>,
  HR: () => <span style={{ fontSize: 13 }}>—</span>,
  CodeBlock: () => (
    <span style={{ fontFamily: "monospace", fontSize: 13 }}>{"/>"}</span>
  ),
};

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

  const isList = activeBlock === "ul" || activeBlock === "ol";

  return (
    <div className="fixed-toolbar" onMouseDown={(e) => e.preventDefault()}>
      {/* ── Inline marks ── */}
      <button
        className={"fixed-toolbar-btn icon-btn" + (activeMarks.has("bold") ? " active" : "")}
        onClick={() => toggleMark("bold")}
        title="加粗"
      >
        <BIcons.Bold />
      </button>
      <button
        className={"fixed-toolbar-btn icon-btn" + (activeMarks.has("italic") ? " active" : "")}
        onClick={() => toggleMark("italic")}
        title="斜体"
      >
        <BIcons.Italic />
      </button>
      <button
        className={"fixed-toolbar-btn icon-btn" + (activeMarks.has("underline") ? " active" : "")}
        onClick={() => toggleMark("underline")}
        title="下划线"
      >
        <BIcons.Underline />
      </button>
      <button
        className={"fixed-toolbar-btn icon-btn" + (activeMarks.has("strikethrough") ? " active" : "")}
        onClick={() => toggleMark("strikethrough")}
        title="删除线"
      >
        <BIcons.Strike />
      </button>
      <button
        className={"fixed-toolbar-btn icon-btn" + (activeMarks.has("code") ? " active" : "")}
        onClick={() => toggleMark("code")}
        title="行内代码"
      >
        <BIcons.Code />
      </button>

      <div className="fixed-toolbar-divider" />

      {/* ── Headings ── */}
      <button
        className={"fixed-toolbar-btn" + (activeBlock === "h1" ? " active" : "")}
        onClick={() => toggleBlock("h1")}
        title="标题 1"
      >
        <BIcons.H1 />
      </button>
      <button
        className={"fixed-toolbar-btn" + (activeBlock === "h2" ? " active" : "")}
        onClick={() => toggleBlock("h2")}
        title="标题 2"
      >
        <BIcons.H2 />
      </button>
      <button
        className={"fixed-toolbar-btn" + (activeBlock === "h3" ? " active" : "")}
        onClick={() => toggleBlock("h3")}
        title="标题 3"
      >
        <BIcons.H3 />
      </button>
      <button
        className={"fixed-toolbar-btn" + (activeBlock === "h4" ? " active" : "")}
        onClick={() => toggleBlock("h4")}
        title="标题 4"
      >
        <BIcons.H4 />
      </button>

      <div className="fixed-toolbar-divider" />

      {/* ── Blocks ── */}
      <button
        className={"fixed-toolbar-btn" + (activeBlock === "blockquote" ? " active" : "")}
        onClick={() => toggleBlock("blockquote")}
        title="引用"
      >
        <BIcons.Quote />
      </button>
      <button
        className={"fixed-toolbar-btn" + (isList && activeBlock === "ul" ? " active" : "")}
        onClick={() => handleList("ul")}
        title="无序列表"
      >
        <BIcons.UL />
      </button>
      <button
        className={"fixed-toolbar-btn" + (isList && activeBlock === "ol" ? " active" : "")}
        onClick={() => handleList("ol")}
        title="有序列表"
      >
        <BIcons.OL />
      </button>
      <button
        className={"fixed-toolbar-btn" + (activeBlock === "code_block" ? " active" : "")}
        onClick={handleCodeBlock}
        title="代码块"
      >
        <BIcons.CodeBlock />
      </button>
      <button
        className="fixed-toolbar-btn"
        onClick={handleHR}
        title="水平线"
      >
        <BIcons.HR />
      </button>
    </div>
  );
};

export default FixedToolbar;

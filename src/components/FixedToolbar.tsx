import React from "react";
import { toggleList } from "@platejs/list";
import { toggleCodeBlock } from "@platejs/code-block";
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
} from "@ant-design/icons";

interface Props {
  editor: any;
  activeMarks: ReadonlySet<string>;
  activeBlock: string;
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

  const isList = activeBlock === "ul" || activeBlock === "ol";

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
        className={"fixed-toolbar-btn" + (activeBlock === "code_block" ? " active" : "")}
        onClick={handleCodeBlock}
        title="代码块"
      >
        <CodeOutlined />
      </button>
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

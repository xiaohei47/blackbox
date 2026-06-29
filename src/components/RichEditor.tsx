import React, { useCallback, useMemo, useState } from "react";
import { Plate, PlateContent } from "platejs/react";
import { createPlateEditor } from "@platejs/core/react";
import { deserializeHtml } from "@platejs/core";
import {
  BasicBlocksPlugin,
  BasicMarksPlugin,
  HorizontalRulePlugin,
} from "@platejs/basic-nodes/react";
import { ListPlugin } from "@platejs/list/react";
import { ImagePlugin } from "@platejs/media/react";
import { insertImage } from "@platejs/media";
import { CodeBlockPlugin } from "@platejs/code-block/react";
import { TrailingBlockPlugin, ExitBreakPlugin } from "@platejs/utils";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import FixedToolbar from "./FixedToolbar";

// ── HTML serialization (Slate JSON → HTML string) ──

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function serializeNode(node: any): string {
  if (node.text !== undefined) {
    let text = escapeHtml(node.text);
    if (node.bold) text = `<strong>${text}</strong>`;
    if (node.italic) text = `<em>${text}</em>`;
    if (node.underline) text = `<u>${text}</u>`;
    if (node.strikethrough) text = `<s>${text}</s>`;
    if (node.code) text = `<code>${text}</code>`;
    return text;
  }

  const children = (node.children || []).map((n: any) => serializeNode(n)).join("");

  switch (node.type) {
    case "blockquote":
      return `<blockquote>${children}</blockquote>`;
    case "ul":
      return `<ul>${children}</ul>`;
    case "ol":
      return `<ol>${children}</ol>`;
    case "li":
      return `<li>${children}</li>`;
    case "h1":
      return `<h1>${children}</h1>`;
    case "h2":
      return `<h2>${children}</h2>`;
    case "h3":
      return `<h3>${children}</h3>`;
    case "h4":
      return `<h4>${children}</h4>`;
    case "h5":
      return `<h5>${children}</h5>`;
    case "h6":
      return `<h6>${children}</h6>`;
    case "img":
      return `<img src="${escapeHtml(node.url || "")}" />`;
    case "hr":
      return `<hr />`;
    case "code_block":
      return `<pre><code>${children}</code></pre>`;
    default:
      return `<p>${children}</p>`;
  }
}

function serializeToHtml(value: any[]): string {
  return value.map((n) => serializeNode(n)).join("");
}

// ── Parse content into Slate nodes ──

function parseContent(content: string): any[] {
  if (!content) return [{ type: "p", children: [{ text: "" }] }];

  // Try JSON (Slate nodes)
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // not JSON
  }

  // Try HTML
  const trimmed = content.trim();
  if (trimmed.startsWith("<") || trimmed.includes("<")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tempEditor = createPlateEditor({}) as any;
      const fragment = deserializeHtml(tempEditor, { element: content });
      if (fragment && fragment.length > 0) return fragment;
    } catch {
      // fall through to plain text
    }
  }

  // Plain text fallback
  return [{ type: "p", children: [{ text: content }] }];
}

// ── Props ──

interface Props {
  content: string;
  noteId: string;
  appDataDir: string;
  onUpdate: (html: string) => void;
}

// ── Component ──

const RichEditor: React.FC<Props> = ({ content, noteId, appDataDir, onUpdate }) => {
  // Parse initial content once on mount (key={activeId} handles remounting)
  const initialValue = useMemo(() => parseContent(content), []);

  // ── Toolbar active state tracking ──
  const [activeMarks, setActiveMarks] = useState<Set<string>>(new Set());
  const [activeBlock, setActiveBlock] = useState("p");

  // Create Plate editor with plugins and initial content
  const editor = useMemo(() => {
    const ed = createPlateEditor({
      plugins: [
        BasicBlocksPlugin,
        BasicMarksPlugin,
        HorizontalRulePlugin,
        ListPlugin,
        ImagePlugin,
        CodeBlockPlugin,
        TrailingBlockPlugin,
        ExitBreakPlugin,
      ],
    });
    ed.children = initialValue as any;
    return ed;
  }, []);

  // ── Selection change → update toolbar active state ──
  const handleSelectionChange = useCallback(
    ({ editor: ed }: { editor: any }) => {
      // Marks
      const marks = ed.getMarks() || {};
      const nextMarks = new Set<string>();
      if (marks.bold) nextMarks.add("bold");
      if (marks.italic) nextMarks.add("italic");
      if (marks.underline) nextMarks.add("underline");
      if (marks.strikethrough) nextMarks.add("strikethrough");
      if (marks.code) nextMarks.add("code");
      setActiveMarks(nextMarks);

      // Block at cursor
      try {
        const entry = ed.api.block();
        if (entry) {
          setActiveBlock(entry[0].type || "p");
        } else {
          setActiveBlock("p");
        }
      } catch {
        setActiveBlock("p");
      }
    },
    [],
  );

  // Content change handler → serialize to HTML
  const handleValueChange = useCallback(
    (options: { editor: any; value: any }) => {
      const value = options.value;
      if (!Array.isArray(value) || value.length === 0) return;
      const html = serializeToHtml(value);
      onUpdate(html);
    },
    [onUpdate],
  );

  // Image paste handler
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      if (!editor) return;

      const items = e.clipboardData?.items;
      const files = e.clipboardData?.files;

      let imageFile: File | null = null;

      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            const file = items[i].getAsFile();
            if (file) {
              imageFile = file;
              break;
            }
          }
        }
      }

      if (!imageFile && files) {
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith("image/")) {
            imageFile = files[i];
            break;
          }
        }
      }

      if (!imageFile) return;

      e.preventDefault();

      try {
        const buf = await imageFile.arrayBuffer();
        const data = new Uint8Array(buf);
        const ext = imageFile.type.split("/")[1] || "png";

        const result = await invoke<{ storage_name: string }>("save_pasted_image", {
          noteId,
          data,
          ext,
        });

        const fullPath = `${appDataDir}/files/${noteId}/${result.storage_name}`;
        const src = convertFileSrc(fullPath);

        insertImage(editor, src);
      } catch (err) {
        console.error("图片粘贴失败", err);
      }
    },
    [editor, noteId, appDataDir],
  );

  if (!editor) return null;

  return (
    <div className="rich-editor">
      <Plate editor={editor} onValueChange={handleValueChange} onSelectionChange={handleSelectionChange}>
        <FixedToolbar editor={editor} activeMarks={activeMarks} activeBlock={activeBlock} />
        <PlateContent
          placeholder="开始写点什么..."
          onPaste={handlePaste}
        />
      </Plate>
    </div>
  );
};

export default RichEditor;

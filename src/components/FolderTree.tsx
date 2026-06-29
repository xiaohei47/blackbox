import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input, Dropdown, message, type MenuProps } from "antd";
import {
  FolderOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  MoreOutlined,
  PlusOutlined,
  FileAddOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { FolderNode, Folder } from "../folders-repo";
import { createFolder, renameFolder, deleteFolder } from "../folders-repo";
import type { Note } from "../notes-repo";
import "./FolderTree.css";

interface Props {
  nodes: FolderNode[];
  flatFolders: Folder[];
  notes: Note[];
  selectedFolderId: string | null;
  selectedNoteId: string | null;
  renamingNoteId: string | null;
  noteCounts: Map<string, number>;
  onSelectFolder: (folderId: string | null) => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onFinishRenameNote: (noteId: string, title: string) => void;
  onRefresh: () => void;
}

function findAncestors(
  folderId: string,
  flatFolders: Folder[],
): string[] {
  const ancestors: string[] = [];
  let currentId: string | null = folderId;
  const map = new Map(flatFolders.map((f) => [f.id, f]));
  while (currentId) {
    const f = map.get(currentId);
    if (!f) break;
    ancestors.push(f.id);
    currentId = f.parentId;
  }
  return ancestors;
}

const FolderTree: React.FC<Props> = ({
  nodes,
  flatFolders,
  notes,
  selectedFolderId,
  selectedNoteId,
  renamingNoteId,
  noteCounts,
  onSelectFolder,
  onSelectNote,
  onCreateNote,
  onFinishRenameNote,
  onRefresh,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [searchText, setSearchText] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand ancestors when a folder is selected
  useEffect(() => {
    if (selectedFolderId) {
      const ancestors = findAncestors(selectedFolderId, flatFolders);
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const id of ancestors) next.add(id);
        return next;
      });
    }
  }, [selectedFolderId, flatFolders]);

  // Auto-focus rename input when renaming starts
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateFolder = async (parentId: string | null) => {
    const folder = await createFolder("未命名文件夹", parentId);
    setRenamingId(folder.id);
    setRenameValue("未命名文件夹");
    if (parentId) {
      setExpanded((prev) => new Set(prev).add(parentId));
    }
    onRefresh();
  };

  const handleStartRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const handleFinishRename = async () => {
    if (renamingId) {
      const name = renameValue.trim() || "未命名文件夹";
      await renameFolder(renamingId, name);
      onRefresh();
    }
    setRenamingId(null);
  };

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      const cnt = noteCounts.get(id) ?? 0;
      if (cnt > 0) {
        message.warning(`该文件夹中有 ${cnt} 篇笔记，请先移走或删除笔记后再删除文件夹`);
        return;
      }
      const ok = confirm("确定删除此空文件夹？");
      if (!ok) return;
      await deleteFolder(id);
      onRefresh();
    },
    [noteCounts, onRefresh],
  );

  const count = (id: string) => noteCounts.get(id) ?? 0;

  // Get notes for a specific folder, filtered by search
  const notesForFolder = (folderId: string | null) => {
    let filtered = notes.filter((n) => n.folderId === folderId);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q),
      );
    }
    return filtered;
  };

  // All notes filtered by search (for "all" view)
  const allFilteredNotes = searchText.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(searchText.trim().toLowerCase()) ||
          n.content.toLowerCase().includes(searchText.trim().toLowerCase()),
      )
    : notes;

  const renderNoteItem = (note: Note, depth: number) => {
    const isSelected = note.id === selectedNoteId;
    const isRenaming = note.id === renamingNoteId;

    return (
      <div
        key={note.id}
        className={`tree-item note-item${isSelected ? " selected" : ""}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => {
          if (!isRenaming) onSelectNote(note.id);
        }}
      >
        <span className="tree-chevron tree-chevron-empty" />
        <FileTextOutlined className="note-item-icon" />
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="folder-rename-inline"
            value={note.title}
            onChange={(e) => onFinishRenameNote(note.id, e.target.value)}
            onBlur={() => onFinishRenameNote(note.id, note.title)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value.trim() || "未命名笔记";
                onFinishRenameNote(note.id, val);
              }
              if (e.key === "Escape") {
                onFinishRenameNote(note.id, note.title);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="tree-item-name">{note.title || "无标题"}</span>
        )}
      </div>
    );
  };

  const renderNode = (node: FolderNode): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.folder.id);
    const isSelected = node.folder.id === selectedFolderId;
    const itemCount = count(node.folder.id);
    const folderNotes = notesForFolder(node.folder.id);

    const contextMenu: MenuProps = {
      items: [
        {
          key: "new-folder",
          icon: <FolderOutlined />,
          label: "新建子文件夹",
          onClick: () => handleCreateFolder(node.folder.id),
        },
        {
          key: "new-note",
          icon: <FileAddOutlined />,
          label: "新建笔记",
          onClick: () => {
            onSelectFolder(node.folder.id);
            onCreateNote();
          },
        },
        { type: "divider" },
        {
          key: "rename",
          label: "重命名",
          onClick: () => handleStartRename(node.folder.id, node.folder.name),
        },
        {
          key: "delete",
          label: "删除",
          danger: true,
          disabled: itemCount > 0,
          onClick: () => handleDeleteFolder(node.folder.id),
        },
      ],
    };

    const isRenaming = renamingId === node.folder.id;

    return (
      <div key={node.folder.id}>
        <div
          className={`tree-item folder-tree-item${isSelected ? " selected" : ""}`}
          style={{ paddingLeft: 12 + node.depth * 16 }}
        >
          {hasChildren || folderNotes.length > 0 ? (
            <span
              className="tree-chevron"
              onClick={() => toggleExpand(node.folder.id)}
            >
              {isExpanded ? "▾" : "▸"}
            </span>
          ) : (
            <span className="tree-chevron tree-chevron-empty" />
          )}

          <span
            className="tree-item-label"
            onClick={() => onSelectFolder(node.folder.id)}
          >
            {isExpanded ? (
              <FolderOpenOutlined className="folder-icon" />
            ) : (
              <FolderOutlined className="folder-icon" />
            )}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                className="folder-rename-inline"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFinishRename();
                  if (e.key === "Escape") setRenamingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="tree-item-name">{node.folder.name}</span>
            )}
          </span>

          <span className="tree-item-count">
            {itemCount > 0 ? itemCount : ""}
          </span>

          <Dropdown menu={contextMenu} trigger={["click"]}>
            <span className="tree-item-more" onClick={(e) => e.stopPropagation()}>
              <MoreOutlined />
            </span>
          </Dropdown>
        </div>

        {isExpanded && (
          <div className="tree-children">
            {folderNotes.map((n) => renderNoteItem(n, node.depth + 1))}
            {node.children.map(renderNode)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="folder-tree">
      {/* Search input replaces header text */}
      <div className="folder-tree-search-row">
        <Input
          placeholder="搜索笔记..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          variant="borderless"
          allowClear
        />
        <button className="search-action-btn" title="新建笔记" onClick={onCreateNote}>
          <FileAddOutlined />
        </button>
        <button className="search-action-btn" title="新建文件夹" onClick={() => handleCreateFolder(null)}>
          <PlusOutlined />
        </button>
      </div>

      <div className="folder-tree-body">
        {/* If searching, show flat results */}
        {searchText.trim() ? (
          allFilteredNotes.map((n) => renderNoteItem(n, 0))
        ) : (
          /* Otherwise show folder tree */
          nodes.map(renderNode)
        )}

        {!searchText.trim() && nodes.length === 0 && allFilteredNotes.length === 0 && (
          <div className="folder-tree-empty">还没有笔记，点击上方按钮创建</div>
        )}
      </div>
    </div>
  );
};

export default FolderTree;

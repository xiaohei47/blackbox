import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Input, Tree, Dropdown, message, Modal } from "antd";
import type { MenuProps, TreeDataNode, TreeProps } from "antd";
import {
  FolderOutlined,
  FolderOpenOutlined,
  FolderAddOutlined,
  FileTextOutlined,
  MoreOutlined,
  FileAddOutlined,
  SearchOutlined,
  DeleteOutlined,
  SyncOutlined,
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
  onCreateNote: (folderId?: string | null) => void;
  onStartRenameNote?: (noteId: string) => void;
  onFinishRenameNote: (noteId: string, title: string) => void;
  onDeleteNote: (noteId: string) => void;
  onRefresh: () => void;
  onSync?: () => void;
}

interface FolderTreeDataNode extends TreeDataNode {
  nodeType: "folder" | "note";
  folder?: Folder;
  note?: Note;
}

function findAncestors(folderId: string, flatFolders: Folder[]): string[] {
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
  onStartRenameNote,
  onFinishRenameNote,
  onDeleteNote,
  onRefresh,
  onSync,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState("");
  const [noteRenameValue, setNoteRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand ancestors when a folder is selected
  useEffect(() => {
    if (selectedFolderId) {
      const ancestors = findAncestors(selectedFolderId, flatFolders);
      setExpandedKeys((prev) => [...new Set([...prev, ...ancestors])]);
    }
  }, [selectedFolderId, flatFolders]);

  // Auto-focus rename input when renaming starts
  useEffect(() => {
    if (renamingFolderId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingFolderId]);

  // Initialize noteRenameValue when renaming a note
  useEffect(() => {
    if (renamingNoteId) {
      const note = notes.find((n) => n.id === renamingNoteId);
      if (note) setNoteRenameValue(note.title);
    }
  }, [renamingNoteId, notes]);

  // Blur rename input when clicking outside it
  useEffect(() => {
    if (!renamingFolderId && !renamingNoteId) return;
    const handleDocMouseDown = (e: MouseEvent) => {
      if (renameInputRef.current && !renameInputRef.current.contains(e.target as Node)) {
        if (renamingFolderId) {
          const name = folderRenameValue.trim() || "未命名文件夹";
          const fid = renamingFolderId;
          setRenamingFolderId(null);
          renameFolder(fid, name).then(() => onRefresh());
        }
        if (renamingNoteId) {
          onFinishRenameNote(renamingNoteId, noteRenameValue);
        }
      }
    };
    document.addEventListener("mousedown", handleDocMouseDown);
    return () => document.removeEventListener("mousedown", handleDocMouseDown);
  }, [renamingFolderId, renamingNoteId, folderRenameValue, noteRenameValue, onFinishRenameNote, onRefresh]);

  // ── Folder operations ──

  const handleCreateFolder = async (parentId: string | null) => {
    const folder = await createFolder("未命名文件夹", parentId);
    setRenamingFolderId(folder.id);
    setFolderRenameValue("未命名文件夹");
    if (parentId) {
      setExpandedKeys((prev) => [...new Set([...prev, parentId])]);
    }
    onRefresh();
  };

  const handleStartRenameFolder = (id: string, currentName: string) => {
    setRenamingFolderId(id);
    setFolderRenameValue(currentName);
  };

  const handleFinishRenameFolder = async () => {
    if (renamingFolderId) {
      const name = folderRenameValue.trim() || "未命名文件夹";
      const fid = renamingFolderId;
      setRenamingFolderId(null); // exit rename immediately
      await renameFolder(fid, name);
      onRefresh();
    } else {
      setRenamingFolderId(null);
    }
  };

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      const cnt = noteCounts.get(id) ?? 0;
      if (cnt > 0) {
        message.warning(`该文件夹中有 ${cnt} 篇笔记，请先移走或删除笔记后再删除文件夹`);
        return;
      }
      const ok = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: "确定删除此空文件夹？",
          okText: "删除",
          okType: "danger",
          cancelText: "取消",
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!ok) return;
      await deleteFolder(id);
      onRefresh();
    },
    [noteCounts, onRefresh],
  );

  const count = (id: string) => noteCounts.get(id) ?? 0;

  // Filter notes for a specific folder
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

  // All notes filtered by search (for flat "all" view)
  const allFilteredNotes = useMemo(
    () =>
      searchText.trim()
        ? notes.filter(
            (n) =>
              n.title.toLowerCase().includes(searchText.trim().toLowerCase()) ||
              n.content.toLowerCase().includes(searchText.trim().toLowerCase()),
          )
        : notes,
    [notes, searchText],
  );

  // ── Build tree data ──

  const treeData = useMemo(() => {
    const build = (fNodes: FolderNode[]): FolderTreeDataNode[] => {
      return fNodes.map((node) => {
        const folderNotes = notesForFolder(node.folder.id);
        const children: FolderTreeDataNode[] = [];

        for (const note of folderNotes) {
          children.push({
            key: note.id,
            nodeType: "note",
            note,
            isLeaf: true,
          });
        }

        for (const child of build(node.children)) {
          children.push(child);
        }

        return {
          key: node.folder.id,
          nodeType: "folder",
          folder: node.folder,
          children: children.length > 0 ? children : undefined,
        };
      });
    };
    return build(nodes);
  }, [nodes, notes, searchText]);

  // ── Tree event handler ──

  const handleSelect: TreeProps["onSelect"] = (selectedKeys, info) => {
    if (selectedKeys.length === 0) return;

    // Exit rename mode immediately when clicking on a different node
    if (renamingFolderId) {
      const name = folderRenameValue.trim() || "未命名文件夹";
      const fid = renamingFolderId;
      setRenamingFolderId(null);
      renameFolder(fid, name).then(() => onRefresh());
    }
    if (renamingNoteId) {
      onFinishRenameNote(renamingNoteId, noteRenameValue);
    }

    const node = info.node as unknown as FolderTreeDataNode;
    if (node.nodeType === "folder") {
      onSelectFolder(node.key as string);
    } else if (node.nodeType === "note") {
      onSelectNote(node.key as string);
    }
  };

  // ── Title renderer ──

  const titleRender = (node: TreeDataNode): React.ReactNode => {
    const dataNode = node as FolderTreeDataNode;

    if (dataNode.nodeType === "note" && dataNode.note) {
      const note = dataNode.note;
      const isRenaming = note.id === renamingNoteId;
      const isSelected = note.id === selectedNoteId;

      return (
        <span
          className={`tree-title-content note-title${isSelected ? " selected" : ""}`}
          onDoubleClick={(e) => {
            if (!isRenaming) { e.stopPropagation(); onStartRenameNote?.(note.id); }
          }}
        >
          <FileTextOutlined className="tree-note-icon" />
          {isRenaming ? (
            <input
              ref={renameInputRef}
              className="tree-rename-inline"
              value={noteRenameValue}
              onChange={(e) => setNoteRenameValue(e.target.value)}
              onBlur={() => {
                const val = noteRenameValue.trim() || "未命名笔记";
                onFinishRenameNote(note.id, val);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === "Escape") {
                  onFinishRenameNote(note.id, note.title);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="tree-item-text">{note.title || "无标题"}</span>
          )}
          {!isRenaming && (
            <span
              className="tree-item-delete"
              onClick={(e) => {
                e.stopPropagation();
                Modal.confirm({
                  title: "确定删除此笔记？",
                  okText: "删除",
                  okType: "danger",
                  cancelText: "取消",
                  onOk: () => onDeleteNote(note.id),
                });
              }}
            >
              <DeleteOutlined />
            </span>
          )}
        </span>
      );
    }

    if (dataNode.nodeType === "folder" && dataNode.folder) {
      const folder = dataNode.folder;
      const isRenaming = renamingFolderId === folder.id;
      const isSelected = folder.id === selectedFolderId;
      const itemCount = count(folder.id);
      const isExpanded = expandedKeys.includes(folder.id);

      const contextMenu: MenuProps = {
        items: [
          {
            key: "new-folder",
            icon: <FolderOutlined />,
            label: "新建子文件夹",
            onClick: () => handleCreateFolder(folder.id),
          },
          {
            key: "new-note",
            icon: <FileAddOutlined />,
            label: "新建笔记",
            onClick: () => {
              onSelectFolder(folder.id);
              onCreateNote(folder.id);
            },
          },
          { type: "divider" },
          {
            key: "rename",
            label: "重命名",
            onClick: () => handleStartRenameFolder(folder.id, folder.name),
          },
          {
            key: "delete",
            label: "删除",
            danger: true,
            disabled: itemCount > 0,
            onClick: () => handleDeleteFolder(folder.id),
          },
        ],
      };

      return (
        <span
          className={`tree-title-content folder-title${isSelected ? " selected" : ""}`}
          onDoubleClick={(e) => {
            if (!isRenaming) { e.stopPropagation(); handleStartRenameFolder(folder.id, folder.name); }
          }}
        >
          {isExpanded ? (
            <FolderOpenOutlined className="tree-folder-icon" />
          ) : (
            <FolderOutlined className="tree-folder-icon" />
          )}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              className="tree-rename-inline"
              value={folderRenameValue}
              onChange={(e) => setFolderRenameValue(e.target.value)}
              onBlur={handleFinishRenameFolder}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === "Escape") setRenamingFolderId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="tree-item-text">{folder.name}</span>
          )}
          {itemCount > 0 && (
            <span className="tree-item-count">{itemCount}</span>
          )}
          <span
            className="tree-item-more"
            onClick={(e) => e.stopPropagation()}
          >
            <Dropdown menu={contextMenu} trigger={["click"]}>
              <MoreOutlined />
            </Dropdown>
          </span>
        </span>
      );
    }

    return null;
  };

  // ── Render ──

  return (
    <div className="folder-tree">
      <div className="folder-tree-search-row">
        <Input
          placeholder="搜索笔记..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          variant="borderless"
          allowClear
        />
        {onSync && (
          <button className="search-action-btn" title="同步" onClick={onSync}>
            <SyncOutlined />
          </button>
        )}
        <button className="search-action-btn" title="新建文件夹" onClick={() => handleCreateFolder(null)}>
          <FolderAddOutlined />
        </button>
      </div>

      <div className="folder-tree-body">
        {searchText.trim() ? (
          allFilteredNotes.length === 0 ? (
            <div className="folder-tree-empty">没有找到匹配的笔记</div>
          ) : (
            allFilteredNotes.map((n) => (
              <div
                key={n.id}
                className={`folder-tree-flat-item${n.id === selectedNoteId ? " selected" : ""}`}
                onClick={() => onSelectNote(n.id)}
              >
                <FileTextOutlined className="tree-note-icon" />
                <span className="tree-item-text">{n.title || "无标题"}</span>
              </div>
            ))
          )
        ) : nodes.length === 0 && allFilteredNotes.length === 0 ? (
          <div className="folder-tree-empty">还没有笔记，点击上方按钮创建</div>
        ) : (
          <Tree
            treeData={treeData}
            expandedKeys={expandedKeys}
            selectedKeys={[]}
            onExpand={(keys) => setExpandedKeys(keys)}
            onSelect={handleSelect}
            titleRender={titleRender}
            showIcon={false}
            showLine={false}
            blockNode={true}
            className="folder-ant-tree"
          />
        )}
      </div>
    </div>
  );
};

export default FolderTree;

mod mig;

use serde::Serialize;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[derive(Serialize)]
struct ImportedFile {
    storage_name: String,
    original_name: String,
    mime_type: String,
    file_size: u64,
}

#[tauri::command]
async fn import_note_file(
    app: tauri::AppHandle,
    source_path: String,
    note_id: String,
) -> Result<ImportedFile, String> {
    let content = std::fs::read(&source_path).map_err(|e| e.to_string())?;
    let file_size = content.len() as u64;

    let source = Path::new(&source_path);
    let original_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin")
        .to_lowercase();

    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let note_dir = app_dir.join("files").join(&note_id);
    std::fs::create_dir_all(&note_dir).map_err(|e| e.to_string())?;

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let short_id: String = note_id.chars().take(8).collect();
    let storage_name = format!("{}_{}.{}", ts, short_id, ext);
    let dest = note_dir.join(&storage_name);
    std::fs::write(&dest, content).map_err(|e| e.to_string())?;

    let mime_type = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "pdf" => "application/pdf",
        "md" => "text/markdown",
        "txt" => "text/plain",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
    .to_string();

    Ok(ImportedFile {
        storage_name,
        original_name,
        mime_type,
        file_size,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:myhome.db", crate::mig::migrations())
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![import_note_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

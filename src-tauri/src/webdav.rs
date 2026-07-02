use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SyncResponse {
    pub body: Option<String>,
    pub status: u16,
}

/// Helper to build a reqwest Client (no proxy, default TLS).
fn http_client() -> reqwest::Client {
    reqwest::Client::new()
}

/// Test WebDAV connection via PROPFIND.
#[tauri::command]
pub async fn webdav_test_connection(
    url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    let client = http_client();
    let method = reqwest::Method::from_bytes(b"PROPFIND").map_err(|e| e.to_string())?;

    let resp = client
        .request(method, &url)
        .header("Depth", "0")
        .basic_auth(&username, Some(&password))
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let status = resp.status();
    if status.is_success() || status.as_u16() == 207 {
        Ok("连接成功".into())
    } else if status.as_u16() == 401 {
        Err("认证失败，请检查用户名和密码".into())
    } else {
        Err(format!("服务器返回 {} {}", status.as_u16(), status.canonical_reason().unwrap_or("-")))
    }
}

/// GET text content from a WebDAV URL. Returns 404 as `body: null`.
#[tauri::command]
pub async fn webdav_get_text(
    url: String,
    username: String,
    password: String,
) -> Result<SyncResponse, String> {
    let client = http_client();

    let resp = client
        .get(&url)
        .basic_auth(&username, Some(&password))
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let status = resp.status().as_u16();
    if status == 404 {
        return Ok(SyncResponse { body: None, status });
    }
    if !resp.status().is_success() {
        return Err(format!("下载失败 ({}): {}", url, status));
    }
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    Ok(SyncResponse { body: Some(text), status })
}

/// PUT text content to a WebDAV URL.
#[tauri::command]
pub async fn webdav_put_text(
    url: String,
    username: String,
    password: String,
    body: String,
    content_type: String,
) -> Result<SyncResponse, String> {
    let client = http_client();

    let resp = client
        .put(&url)
        .header("Content-Type", content_type)
        .body(body)
        .basic_auth(&username, Some(&password))
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let status = resp.status().as_u16();
    if resp.status().is_success() {
        Ok(SyncResponse { body: None, status })
    } else if status == 409 {
        Err(format!("上传失败 ({}): 远程目录不存在，请先在服务商网页端创建 {} 目录，或设置为空让同步文件直接存放在根目录", url, "blackbox-sync"))
    } else {
        Err(format!("上传失败 ({}): {}", url, status))
    }
}

/// Create a remote directory via MKCOL.
/// Returns `true` if the directory exists or was created, `false` if the parent doesn't exist.
#[tauri::command]
pub async fn webdav_mkcol(
    url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    let client = http_client();
    let method = reqwest::Method::from_bytes(b"MKCOL").map_err(|e| e.to_string())?;

    let resp = client
        .request(method, &url)
        .basic_auth(&username, Some(&password))
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let status = resp.status().as_u16();
    match status {
        201 | 200 | 301 | 302 | 307 | 308 | 405 => {
            // 201 Created, 405 Method Not Allowed = already exists, redirects = handled by server
            Ok("ok".into())
        }
        409 => Err("父目录不存在，请先确保 WebDAV 根目录可写".into()),
        403 => Err("无权限创建目录".into()),
        _ => Err(format!("创建目录失败: {}", status)),
    }
}

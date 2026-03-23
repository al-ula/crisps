use serde::Serialize;
use std::sync::Mutex;
use tauri::Emitter;

#[derive(Clone, Serialize)]
struct EditorActionPayload {
    action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    block_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    rows: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    columns: Option<u32>,
}

pub struct CliFile(pub Mutex<Option<String>>);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn editor_action(
    window: tauri::Window,
    action: String,
    block_type: Option<String>,
    rows: Option<u32>,
    columns: Option<u32>,
) -> Result<(), String> {
    window
        .emit(
            "editor-action",
            EditorActionPayload {
                action,
                block_type,
                rows,
                columns,
            },
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_file_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<FilePath>>();
    app.dialog()
        .file()
        .add_filter("Markdown", &["md", "txt"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });
    let path = rx.await.map_err(|e| e.to_string())?;
    Ok(path.map(|p: FilePath| p.to_string()))
}

#[tauri::command]
async fn save_file_dialog(
    app: tauri::AppHandle,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};
    let mut builder = app.dialog().file().add_filter("Markdown", &["md", "txt"]);
    if let Some(ref p) = default_path {
        if let Some(name) = std::path::Path::new(p).file_name() {
            builder = builder.set_file_name(name.to_string_lossy().as_ref());
        }
    }
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<FilePath>>();
    builder.save_file(move |path| {
        let _ = tx.send(path);
    });
    let path = rx.await.map_err(|e| e.to_string())?;
    Ok(path.map(|p: FilePath| p.to_string()))
}

#[tauri::command]
fn get_cli_file(state: tauri::State<CliFile>) -> Option<String> {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
fn force_close(app: tauri::AppHandle) {
    app.exit(0);
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cli_file: Option<String> = std::env::args()
        .nth(1)
        .filter(|s| !s.starts_with('-'))
        .filter(|s| std::path::Path::new(s).exists());

    tauri::Builder::default()
        .manage(CliFile(Mutex::new(cli_file)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("close-requested", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            editor_action,
            read_file,
            write_file,
            open_file_dialog,
            save_file_dialog,
            get_cli_file,
            force_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

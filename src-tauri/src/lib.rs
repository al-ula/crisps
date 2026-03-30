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
    #[serde(skip_serializing_if = "Option::is_none")]
    target: Option<String>,
}

pub struct CliFile(pub Mutex<Option<String>>);

/// Tracks which editor is currently active ("milkdown" or "source").
pub struct ActiveEditor(pub Mutex<String>);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Set the active editor. Called by the frontend when toggling between modes.
#[tauri::command]
fn set_active_editor(
    editor: String,
    state: tauri::State<ActiveEditor>,
) {
    *state.0.lock().unwrap() = editor;
}

/// Get the currently active editor id.
#[tauri::command]
fn get_active_editor(state: tauri::State<ActiveEditor>) -> String {
    state.0.lock().unwrap().clone()
}

/// Dispatch an editor action. When no explicit target is given, the action is
/// automatically routed to whichever editor is currently active.
#[tauri::command]
fn editor_action(
    window: tauri::Window,
    action: String,
    block_type: Option<String>,
    rows: Option<u32>,
    columns: Option<u32>,
    target: Option<String>,
    state: tauri::State<ActiveEditor>,
) -> Result<(), String> {
    let resolved_target = target.or_else(|| {
        Some(state.0.lock().unwrap().clone())
    });

    window
        .emit(
            "editor-action",
            EditorActionPayload {
                action,
                block_type,
                rows,
                columns,
                target: resolved_target,
            },
        )
        .map_err(|e| e.to_string())
}

/// Convenience command: undo in the active editor.
#[tauri::command]
fn undo(
    window: tauri::Window,
    state: tauri::State<ActiveEditor>,
) -> Result<(), String> {
    let target = state.0.lock().unwrap().clone();
    window
        .emit(
            "editor-action",
            EditorActionPayload {
                action: "undo".to_string(),
                block_type: None,
                rows: None,
                columns: None,
                target: Some(target),
            },
        )
        .map_err(|e| e.to_string())
}

/// Convenience command: redo in the active editor.
#[tauri::command]
fn redo(
    window: tauri::Window,
    state: tauri::State<ActiveEditor>,
) -> Result<(), String> {
    let target = state.0.lock().unwrap().clone();
    window
        .emit(
            "editor-action",
            EditorActionPayload {
                action: "redo".to_string(),
                block_type: None,
                rows: None,
                columns: None,
                target: Some(target),
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
        .manage(ActiveEditor(Mutex::new("milkdown".to_string())))
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
            set_active_editor,
            get_active_editor,
            undo,
            redo,
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

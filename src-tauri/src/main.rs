#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::Path;
use std::process::Command;
use std::sync::Arc;
use tauri::{command, AppHandle, Builder, Manager};
use tokio::{fs, sync::Mutex, time::sleep, time::Duration};
use walkdir::WalkDir;

struct AppState {
    is_deleting: bool,
}

#[command]
async fn search_folders(app: AppHandle, path: String, foldername: String) {
    let mut entries = WalkDir::new(&path).min_depth(1).into_iter();

    let mut count = 0;
    while let Some(entry) = entries.next() {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        if entry.file_type().is_dir() {
            let current_folder_name = entry.file_name().to_string_lossy();

            if current_folder_name == foldername {
                let path_str = entry.path().display().to_string();
                app.emit_all("folder-found", &path_str)
                    .expect("Failed to emit event");
                entries.skip_current_dir();
                count += 1;

                if count % 10 == 0 {
                    sleep(Duration::from_millis(10)).await;
                }
            }
        }
    }
}


#[command]
async fn delete_folders(
    paths: Vec<String>,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<(), String> {
    let mut app_state = state.lock().await;
    if app_state.is_deleting {
        return Err("Delete operation is already in progress".to_string());
    }
    app_state.is_deleting = true;
    drop(app_state); // Unlock before performing async operations

    if paths.is_empty() {
        return Err("没有接收到任何路径信息".to_string());
    }

    for path_str in paths {
        println!("尝试删除: {}", &path_str);
        let path = Path::new(&path_str);

        if !path.exists() {
            println!("路径不存在: {}", path_str);
            continue;
        }

        if !path.is_dir() {
            println!("路径不是一个目录: {}", path_str);
            continue;
        }

        match fs::remove_dir_all(path).await {
            Ok(_) => {
                println!("成功删除: {}", path_str);
                // 验证文件或目录是否已被删除
                if !Path::new(&path_str).exists() {
                    println!("验证删除成功: {}", path_str);
                } else {
                    let error_msg = format!("验证失败，未删除: {}", path_str);
                    eprintln!("{}", error_msg);
                    return Err(error_msg);
                }
            }
            Err(e) => {
                let error_msg = format!("删除失败: {}，错误: {}", path_str, e);
                eprintln!("{}", error_msg);
                return Err(error_msg);
            }
        }
    }
    let mut app_state = state.lock().await;
    app_state.is_deleting = false;
    println!("删除操作完成");
    Ok(())
}

#[command]
async fn open_directory(path: String) -> Result<(), String> {
    if !Path::new(&path).exists() {
        return Err(format!("Directory does not exist: {}", path));
    }
    let open_cmd = if cfg!(target_os = "windows") {
        "explorer"
    } else if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    Command::new(open_cmd)
        .arg(path)
        .spawn()
        .map_err(|e| format!("Failed to open directory: {}", e.to_string()))?;

    Ok(())
}

fn main() {
    let app_state = Arc::new(Mutex::new(AppState { is_deleting: false }));
    Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            search_folders,
            delete_folders,
            open_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

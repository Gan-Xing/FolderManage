#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::Path;
use std::process::Command;
use std::sync::Arc;
use tauri::{command, Builder, Manager, State};
use tokio::{fs, sync::Mutex};
use walkdir::WalkDir;
use std::sync::atomic::{AtomicBool, Ordering};

struct SearchControl {
    should_continue: AtomicBool,
}

impl SearchControl {
    fn new() -> Self {
        Self {
            should_continue: AtomicBool::new(true),
        }
    }

    fn stop(&self) {
        self.should_continue.store(false, Ordering::Relaxed);
    }

    fn continue_search(&self) -> bool {
        self.should_continue.load(Ordering::Relaxed)
    }

    fn reset(&self) {
        self.should_continue.store(true, Ordering::Relaxed);
    }
}



#[command]
async fn stop_search(control: State<'_, Arc<SearchControl>>) -> Result<(), String> {
    control.stop();
    Ok(())
}

struct AppState {
    is_deleting: bool,
}

#[command]
async fn search_folders(
    control: State<'_, Arc<SearchControl>>,
    app: tauri::AppHandle,
    path: String,
    foldername: String,
    skipfolders: Vec<String>,
    digin: bool,
    fuzzy: bool,
    casesense: bool,
) -> Result<(), String> {
    // 重置搜索控制状态以确保搜索可以开始
    control.reset();
    let mut entries = WalkDir::new(&path).min_depth(1).into_iter();

    let mut count = 0;
    let mut actual_digin = digin;
    let foldername_to_match = if casesense { foldername.clone() } else { foldername.to_lowercase() };
    let mut check_counter = 0;

    // 如果任一 skipfolder 与 foldername 相等，设置 actual_digin 为 false
    if skipfolders.iter().any(|s| case_insensitive_eq(s, &foldername, casesense)) {
        actual_digin = false;
    }

    while let Some(entry) = entries.next() {
         if check_counter % 1000 == 0 && !control.continue_search() {
            break;
        }
        check_counter += 1;

        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        if entry.file_type().is_dir() {
            let current_folder_name = entry.file_name().to_string_lossy().to_string();
            let current_folder_name_to_match = if casesense { current_folder_name.clone() } else { current_folder_name.to_lowercase() };

            if skipfolders.iter().any(|s| case_insensitive_eq(s, &current_folder_name, casesense)) {
                app.emit_all("skip-folder-found", &entry.path().display().to_string())
                    .expect("Failed to emit skip folder event");
                entries.skip_current_dir();
                continue;
            }

            let matches = if fuzzy {
                current_folder_name_to_match.contains(&foldername_to_match)
            } else {
                current_folder_name_to_match == foldername_to_match
            };

            if matches {
                count += 1; // 增加 count 计数
                let path_str = entry.path().display().to_string();
                app.emit_all("folder-found", &path_str).expect("Failed to emit event");

                if !actual_digin {
                    entries.skip_current_dir();
                }
            }
        }
    }
    // 检查是否有文件夹被找到
    if count == 0 {
        app.emit_all("no-folders-found", &path)
            .expect("Failed to emit no folders found event");
    }

    Ok(())
}

fn case_insensitive_eq(a: &String, b: &String, casesense: bool) -> bool {
    if casesense {
        a == b
    } else {
        a.to_lowercase() == b.to_lowercase()
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
    let control = Arc::new(SearchControl::new());

    Builder::default()
        .manage(app_state)
        .manage(control)
        .invoke_handler(tauri::generate_handler![search_folders, stop_search, delete_folders,
            open_directory])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{command, AppHandle, Builder, Manager};
use tokio::{time::sleep, time::Duration};
use walkdir::WalkDir;

#[command]
async fn search_folders(app: AppHandle, path: String, foldername: String, skipfolders: Vec<String>, digin: bool, fuzzy: bool, casesense: bool) {
    let mut entries = WalkDir::new(&path).min_depth(1).into_iter();

    let mut count = 0;
    let mut actual_digin = digin;
    let foldername_to_match = if casesense { foldername.clone() } else { foldername.to_lowercase() };

    // 如果任一 skipfolder 与 foldername 相等，设置 actual_digin 为 false
    if skipfolders.iter().any(|s| case_insensitive_eq(s, &foldername, casesense)) {
        actual_digin = false;
    }

    while let Some(entry) = entries.next() {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        if entry.file_type().is_dir() {
            let current_folder_name = entry.file_name().to_string_lossy().to_string();  // 转换为 String
            let current_folder_name_to_match = if casesense { current_folder_name.clone() } else { current_folder_name.to_lowercase() };

            // 检查当前文件夹是否是需要跳过的文件夹之一
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
                let path_str = entry.path().display().to_string();
                app.emit_all("folder-found", &path_str)
                    .expect("Failed to emit event");

                if !actual_digin {
                    entries.skip_current_dir();
                }

                count += 1;
                if count % 10 == 0 {
                    sleep(Duration::from_millis(10)).await;
                }
            }
        }
    }
    // 检查是否有文件夹被找到
    if count == 0 {
        app.emit_all("no-folders-found", &path)
            .expect("Failed to emit no folders found event");
    }
}

fn case_insensitive_eq(a: &String, b: &String, casesense: bool) -> bool {
    if casesense {
        a == b
    } else {
        a.to_lowercase() == b.to_lowercase()
    }
}

fn main() {
    Builder::default()
        .invoke_handler(tauri::generate_handler![
            search_folders
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

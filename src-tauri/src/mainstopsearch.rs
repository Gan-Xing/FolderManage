#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::Arc;
use tauri::{command, Builder, Manager, State};
use tokio::time::{sleep, Duration};
use walkdir::{WalkDir};
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
    let foldername_to_match = if casesense { foldername.clone() } else { foldername.to_lowercase() };
    let mut check_counter = 0;

    while let Some(entry) = entries.next() {
         if check_counter % 100 == 0 && !control.continue_search() {
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
                continue;
            }

            let matches = if fuzzy {
                current_folder_name_to_match.contains(&foldername_to_match)
            } else {
                current_folder_name_to_match == foldername_to_match
            };

            if matches {
                let path_str = entry.path().display().to_string();
                app.emit_all("folder-found", &path_str).expect("Failed to emit event");

                if !digin {
                    entries.skip_current_dir();
                }
            }
        }

        // 少量的异步等待可以保留，但增加其间隔
        if check_counter % 100 == 0 {
            sleep(Duration::from_millis(1)).await;
        }
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

fn main() {
    let control = Arc::new(SearchControl::new());

    Builder::default()
        .manage(control)
        .invoke_handler(tauri::generate_handler![search_folders, stop_search])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

pub mod commands;
pub mod db;

use commands::*;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_members,
            search_members_by_phone,
            add_member,
            update_member,
            delete_member,
            add_record,
            get_services,
            add_service,
            update_service,
            delete_service,
            get_records,
            batch_import_members,
        ])
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");
            let db_path = app_data_dir.join("barber.db");
            db::init_db(&db_path).expect("failed to initialize database");
            app.manage(db_path);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

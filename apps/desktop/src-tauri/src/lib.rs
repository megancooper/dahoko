mod backup;

use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

fn updater_pubkey() -> Option<&'static str> {
    option_env!("TAURI_UPDATER_PUBKEY")
        .map(str::trim)
        .filter(|key| !key.is_empty())
}

#[tauri::command]
fn updater_is_configured() -> bool {
    cfg!(desktop) && updater_pubkey().is_some()
}

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create initial schema",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add recurrence and completion history",
            sql: include_str!("../migrations/0002_recurrence.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().invoke_handler(tauri::generate_handler![
        updater_is_configured,
        backup::replace_all_data
    ]);

    #[cfg(desktop)]
    let builder = {
        let builder = builder.plugin(tauri_plugin_process::init());

        if let Some(pubkey) = updater_pubkey() {
            builder.plugin(tauri_plugin_updater::Builder::new().pubkey(pubkey).build())
        } else {
            builder
        }
    };

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:dahoko.db", migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running dahoko");
}

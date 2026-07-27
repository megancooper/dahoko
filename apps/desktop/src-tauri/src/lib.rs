use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create initial schema",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:dahoko.db", migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running dahoko");
}

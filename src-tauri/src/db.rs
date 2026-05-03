use rusqlite::Connection;
use std::path::Path;

pub fn init_db(db_path: &Path) -> rusqlite::Result<()> {
    let conn = Connection::open(db_path)?;
    
    // 创建 members 表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            level TEXT DEFAULT '普通',
            balance REAL DEFAULT 0.0,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )",
        (),
    )?;
    
    // 创建 services 表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT
        )",
        (),
    )?;
    
    // 创建 records 表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER,
            service_id INTEGER,
            amount REAL NOT NULL,
            payment_method TEXT,
            note TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (member_id) REFERENCES members(id),
            FOREIGN KEY (service_id) REFERENCES services(id)
        )",
        (),
    )?;
    
    // 创建 levels 表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS levels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            discount REAL DEFAULT 1.0,
            threshold REAL DEFAULT 0
        )",
        (),
    )?;
    
    // 插入默认数据
    let services_count: i32 = conn.query_row("SELECT COUNT(*) FROM services", [], |row| row.get(0))?;
    if services_count == 0 {
        conn.execute("INSERT INTO services (name, price, category) VALUES 
            ('洗剪吹', 35, '剪发'),
            ('烫发', 168, '烫染'),
            ('染发', 128, '烫染'),
            ('护理', 88, '护理'),
            ('修面', 25, '其他')", ())?;
    }
    
    let levels_count: i32 = conn.query_row("SELECT COUNT(*) FROM levels", [], |row| row.get(0))?;
    if levels_count == 0 {
        conn.execute("INSERT INTO levels (name, discount, threshold) VALUES 
            ('普通', 1.0, 0),
            ('银卡', 0.9, 500),
            ('金卡', 0.85, 1000)", ())?;
    }
    
    Ok(())
}

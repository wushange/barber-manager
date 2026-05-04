use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
pub struct Member {
    pub id: Option<i32>,
    pub name: String,
    pub phone: String,
    pub level: Option<String>,
    pub balance: Option<f64>,
}

#[derive(Serialize)]
pub struct MemberWithInfo {
    pub id: i32,
    pub name: String,
    pub phone: String,
    pub level: String,
    pub balance: f64,
    pub created_at: String,
    pub last_visit: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ImportMember {
    pub name: String,
    pub phone: String,
    pub level: Option<String>,
    pub balance: Option<f64>,
}

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to 理发管家!", name)
}

fn open_db(db_path: &PathBuf) -> Result<Connection, String> {
    Connection::open(db_path.to_str().unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_members(db_path: tauri::State<PathBuf>) -> Result<Vec<MemberWithInfo>, String> {
    let conn = open_db(db_path.inner())?;
    let mut stmt = conn.prepare(
        "SELECT m.id, m.name, m.phone, m.level, m.balance, m.created_at,
                (SELECT MAX(created_at) FROM records WHERE member_id = m.id) as last_visit
         FROM members m
         ORDER BY m.id DESC"
    ).map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map([], |row| {
        Ok(MemberWithInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            phone: row.get(2)?,
            level: row.get(3)?,
            balance: row.get(4)?,
            created_at: row.get(5)?,
            last_visit: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut members = Vec::new();
    for row in rows {
        members.push(row.map_err(|e| e.to_string())?);
    }
    Ok(members)
}

#[tauri::command]
pub fn search_members_by_phone(
    db_path: tauri::State<PathBuf>,
    phone_tail: String,
) -> Result<Vec<MemberWithInfo>, String> {
    let conn = open_db(db_path.inner())?;
    let mut stmt = conn.prepare(
        "SELECT m.id, m.name, m.phone, m.level, m.balance, m.created_at,
                (SELECT MAX(created_at) FROM records WHERE member_id = m.id) as last_visit
         FROM members m
         WHERE m.phone LIKE ?1
         ORDER BY m.id DESC"
    ).map_err(|e| e.to_string())?;
    
    let pattern = format!("%{}", phone_tail);
    let rows = stmt.query_map([pattern], |row| {
        Ok(MemberWithInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            phone: row.get(2)?,
            level: row.get(3)?,
            balance: row.get(4)?,
            created_at: row.get(5)?,
            last_visit: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut members = Vec::new();
    for row in rows {
        members.push(row.map_err(|e| e.to_string())?);
    }
    Ok(members)
}

#[tauri::command]
pub fn add_member(db_path: tauri::State<PathBuf>, member: Member) -> Result<i32, String> {
    let conn = open_db(db_path.inner())?;
    conn.execute(
        "INSERT INTO members (name, phone, level, balance) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![member.name, member.phone, member.level.unwrap_or("普通".to_string()), member.balance.unwrap_or(0.0)],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid() as i32)
}

#[tauri::command]
pub fn update_member(db_path: tauri::State<PathBuf>, member: Member) -> Result<(), String> {
    let conn = open_db(db_path.inner())?;
    conn.execute(
        "UPDATE members SET name = ?1, phone = ?2, level = ?3, balance = ?4 WHERE id = ?5",
        rusqlite::params![member.name, member.phone, member.level, member.balance, member.id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_member(db_path: tauri::State<PathBuf>, id: i32) -> Result<(), String> {
    let conn = open_db(db_path.inner())?;
    conn.execute("DELETE FROM records WHERE member_id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM members WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn add_record(
    db_path: tauri::State<PathBuf>,
    member_id: i32,
    service_id: i32,
    amount: f64,
    payment_method: String,
    note: Option<String>,
) -> Result<(), String> {
    let conn = open_db(db_path.inner())?;
    conn.execute(
        "INSERT INTO records (member_id, service_id, amount, payment_method, note) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![member_id, service_id, amount, payment_method.clone(), note],
    ).map_err(|e| e.to_string())?;
    
    if payment_method.contains("余额") {
        conn.execute(
            "UPDATE members SET balance = balance - ?1 WHERE id = ?2",
            rusqlite::params![amount, member_id],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_services(db_path: tauri::State<PathBuf>) -> Result<Vec<(i32, String, f64, String)>, String> {
    let conn = open_db(db_path.inner())?;
    let mut stmt = conn.prepare("SELECT id, name, price, category FROM services ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    }).map_err(|e| e.to_string())?;
    
    let mut services = Vec::new();
    for row in rows {
        services.push(row.map_err(|e| e.to_string())?);
    }
    Ok(services)
}

#[tauri::command]
pub fn add_service(
    db_path: tauri::State<PathBuf>,
    name: String,
    price: f64,
    category: String,
) -> Result<i32, String> {
    let conn = open_db(db_path.inner())?;
    conn.execute(
        "INSERT INTO services (name, price, category) VALUES (?1, ?2, ?3)",
        rusqlite::params![name, price, category],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid() as i32)
}

#[tauri::command]
pub fn update_service(
    db_path: tauri::State<PathBuf>,
    id: i32,
    name: String,
    price: f64,
    category: String,
) -> Result<(), String> {
    let conn = open_db(db_path.inner())?;
    conn.execute(
        "UPDATE services SET name = ?1, price = ?2, category = ?3 WHERE id = ?4",
        rusqlite::params![name, price, category, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_service(db_path: tauri::State<PathBuf>, id: i32) -> Result<(), String> {
    let conn = open_db(db_path.inner())?;
    conn.execute("DELETE FROM services WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_records(db_path: tauri::State<PathBuf>, member_id: Option<i32>) -> Result<Vec<(i32, String, String, f64, String, String, String)>, String> {
    let conn = open_db(db_path.inner())?;
    
    let mut records = Vec::new();
    if let Some(mid) = member_id {
        let mut stmt = conn.prepare(
            "SELECT r.id, m.name, s.name, r.amount, r.payment_method, COALESCE(r.note, ''), r.created_at 
             FROM records r 
             JOIN members m ON r.member_id = m.id 
             JOIN services s ON r.service_id = s.id 
             WHERE r.member_id = ?1 
             ORDER BY r.created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([mid], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?))
        }).map_err(|e| e.to_string())?;
        for row in rows {
            records.push(row.map_err(|e| e.to_string())?);
        }
    } else {
        let mut stmt = conn.prepare(
            "SELECT r.id, m.name, s.name, r.amount, r.payment_method, COALESCE(r.note, ''), r.created_at 
             FROM records r 
             JOIN members m ON r.member_id = m.id 
             JOIN services s ON r.service_id = s.id 
             ORDER BY r.created_at DESC 
             LIMIT 100"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?))
        }).map_err(|e| e.to_string())?;
        for row in rows {
            records.push(row.map_err(|e| e.to_string())?);
        }
    }
    
    Ok(records)
}

#[tauri::command]
pub fn batch_import_members(
    db_path: tauri::State<PathBuf>,
    members: Vec<ImportMember>,
) -> Result<(usize, usize), String> {
    let conn = open_db(db_path.inner())?;
    let mut imported = 0;
    let mut skipped = 0;
    
    for member in members {
        // 检查手机号是否已存在
        let exists: bool = conn.query_row(
            "SELECT 1 FROM members WHERE phone = ?1",
            rusqlite::params![member.phone],
            |_| Ok(true),
        ).unwrap_or(false);
        
        if exists {
            skipped += 1;
            continue;
        }
        
        // 插入会员
        match conn.execute(
            "INSERT INTO members (name, phone, level, balance) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                member.name,
                member.phone,
                member.level.unwrap_or("普通".to_string()),
                member.balance.unwrap_or(0.0)
            ],
        ) {
            Ok(_) => imported += 1,
            Err(_) => skipped += 1,
        }
    }
    
    Ok((imported, skipped))
}

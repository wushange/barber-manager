const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 判断是否在 pkg 打包环境中运行
const isPkg = typeof process.pkg !== 'undefined';

// 基础目录：
//   - pkg 环境：exe 所在目录（数据目录放在这里）
//   - 普通环境：项目根目录
const BASE_DIR = isPkg ? path.dirname(process.execPath) : __dirname;

// 数据目录（放 exe 旁边，可写）
const DATA_DIR = path.join(BASE_DIR, 'data');
const BACKUP_DIR = path.join(BASE_DIR, 'backups');

// 静态文件目录：
//   - pkg 环境：__dirname 指向 pkg 内嵌的虚拟路径
//   - 普通环境：项目根目录下的 dist/
const DIST_DIR = isPkg ? path.join(__dirname, 'dist') : path.join(__dirname, 'dist');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// 数据文件路径
const FILES = {
  members: path.join(DATA_DIR, 'members.json'),
  services: path.join(DATA_DIR, 'services.json'),
  records: path.join(DATA_DIR, 'records.json'),
};

// 默认数据
const DEFAULT_DATA = {
  members: [],
  services: [
    { id: 1, name: '洗剪吹', price: 35, category: '基础' },
    { id: 2, name: '单剪', price: 25, category: '基础' },
    { id: 3, name: '洗头', price: 15, category: '基础' },
    { id: 4, name: '染发', price: 128, category: '烫染' },
    { id: 5, name: '烫发', price: 168, category: '烫染' },
    { id: 6, name: '护理', price: 88, category: '护理' },
  ],
  records: [],
};

// 读取数据
function readData(type) {
  try {
    if (fs.existsSync(FILES[type])) {
      const data = fs.readFileSync(FILES[type], 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`读取 ${type} 失败:`, e.message);
  }
  return DEFAULT_DATA[type] || [];
}

// 保存数据
function saveData(type, data) {
  try {
    fs.writeFileSync(FILES[type], JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`保存 ${type} 失败:`, e.message);
    return false;
  }
}

// 生成备份文件名（按周）
function getBackupFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);
  return `backup-${year}-W${week.toString().padStart(2, '0')}.json`;
}

// 获取周数
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// 执行备份
function doBackup() {
  const backupFile = path.join(BACKUP_DIR, getBackupFilename());
  if (fs.existsSync(backupFile)) {
    fs.unlinkSync(backupFile);
  }
  const backup = {
    backupTime: new Date().toISOString(),
    members: readData('members'),
    services: readData('services'),
    records: readData('records'),
  };
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`✓ 备份已创建: ${backupFile}`);
  cleanOldBackups();
  return backupFile;
}

// 清理旧备份
function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        fpath: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    if (files.length > 12) {
      files.slice(12).forEach(f => {
        fs.unlinkSync(f.fpath);
        console.log(`  删除旧备份: ${f.name}`);
      });
    }
  } catch (e) {
    console.error('清理旧备份失败:', e.message);
  }
}

// 获取备份列表
function getBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        fpath: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.toISOString(),
        size: fs.statSync(path.join(BACKUP_DIR, f)).size
      }))
      .sort((a, b) => new Date(b.time) - new Date(a.time));
  } catch (e) {
    return [];
  }
}

// CORS 头
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// 创建服务器
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // 处理 OPTIONS 请求
  if (method === 'OPTIONS') {
    res.writeHead(200, CORS_HEADERS);
    res.end();
    return;
  }

  // API 路由
  if (pathname.startsWith('/api/')) {
    const endpoint = pathname.replace('/api/', '');

    // GET 请求
    if (method === 'GET') {
      switch (endpoint) {
        case 'members':
          res.writeHead(200, CORS_HEADERS);
          res.end(JSON.stringify(readData('members')));
          return;
        case 'services':
          res.writeHead(200, CORS_HEADERS);
          res.end(JSON.stringify(readData('services')));
          return;
        case 'records':
          res.writeHead(200, CORS_HEADERS);
          res.end(JSON.stringify(readData('records')));
          return;
        case 'backups':
          res.writeHead(200, CORS_HEADERS);
          res.end(JSON.stringify(getBackups()));
          return;
        case 'export':
          const allData = {
            exportTime: new Date().toISOString(),
            members: readData('members'),
            services: readData('services'),
            records: readData('records'),
          };
          res.writeHead(200, {
            ...CORS_HEADERS,
            'Content-Disposition': `attachment; filename="barber-backup-${new Date().toISOString().split('T')[0]}.json"`
          });
          res.end(JSON.stringify(allData, null, 2));
          return;
      }
    }

    // POST 请求
    if (method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          switch (endpoint) {
            case 'members': {
              const members = readData('members');
              const newMember = { ...data, id: Date.now(), created_at: new Date().toISOString() };
              members.push(newMember);
              saveData('members', members);
              res.writeHead(201, CORS_HEADERS);
              res.end(JSON.stringify(newMember));
              return;
            }
            case 'services': {
              const services = readData('services');
              const newService = { ...data, id: Date.now() };
              services.push(newService);
              saveData('services', services);
              res.writeHead(201, CORS_HEADERS);
              res.end(JSON.stringify(newService));
              return;
            }
            case 'records': {
              const records = readData('records');
              const newRecord = { ...data, id: Date.now(), created_at: new Date().toISOString() };
              records.unshift(newRecord);
              saveData('records', records);
              const members2 = readData('members');
              const memberIndex = members2.findIndex(m => m.id === data.member_id);
              if (memberIndex !== -1) {
                members2[memberIndex].last_visit = new Date().toISOString();
                saveData('members', members2);
              }
              res.writeHead(201, CORS_HEADERS);
              res.end(JSON.stringify(newRecord));
              return;
            }
            case 'import':
              if (data.members) saveData('members', data.members);
              if (data.services) saveData('services', data.services);
              if (data.records) saveData('records', data.records);
              res.writeHead(200, CORS_HEADERS);
              res.end(JSON.stringify({ success: true }));
              return;
            case 'backup': {
              const backupFile = doBackup();
              res.writeHead(200, CORS_HEADERS);
              res.end(JSON.stringify({ success: true, file: backupFile, message: '备份成功' }));
              return;
            }
            case 'clear':
              saveData('members', []);
              saveData('records', []);
              res.writeHead(200, CORS_HEADERS);
              res.end(JSON.stringify({ success: true }));
              return;
          }
        } catch (e) {
          res.writeHead(400, CORS_HEADERS);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // PUT 请求
    if (method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const id = parseInt(parsedUrl.query.id);
          switch (endpoint) {
            case 'members': {
              const members = readData('members');
              const index = members.findIndex(m => m.id === id);
              if (index !== -1) {
                members[index] = { ...members[index], ...data };
                saveData('members', members);
                res.writeHead(200, CORS_HEADERS);
                res.end(JSON.stringify(members[index]));
              } else {
                res.writeHead(404, CORS_HEADERS);
                res.end(JSON.stringify({ error: 'Member not found' }));
              }
              return;
            }
            case 'services': {
              const services = readData('services');
              const sIndex = services.findIndex(s => s.id === id);
              if (sIndex !== -1) {
                services[sIndex] = { ...services[sIndex], ...data };
                saveData('services', services);
                res.writeHead(200, CORS_HEADERS);
                res.end(JSON.stringify(services[sIndex]));
              } else {
                res.writeHead(404, CORS_HEADERS);
                res.end(JSON.stringify({ error: 'Service not found' }));
              }
              return;
            }
          }
        } catch (e) {
          res.writeHead(400, CORS_HEADERS);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // DELETE 请求
    if (method === 'DELETE') {
      const id = parseInt(parsedUrl.query.id);
      switch (endpoint) {
        case 'members': {
          const members = readData('members');
          const filtered = members.filter(m => m.id !== id);
          if (filtered.length < members.length) {
            saveData('members', filtered);
            const records = readData('records');
            saveData('records', records.filter(r => r.member_id !== id));
          }
          res.writeHead(200, CORS_HEADERS);
          res.end(JSON.stringify({ success: true }));
          return;
        }
        case 'services':
          saveData('services', readData('services').filter(s => s.id !== id));
          res.writeHead(200, CORS_HEADERS);
          res.end(JSON.stringify({ success: true }));
          return;
        case 'records':
          saveData('records', readData('records').filter(r => r.id !== id));
          res.writeHead(200, CORS_HEADERS);
          res.end(JSON.stringify({ success: true }));
          return;
      }
    }

    res.writeHead(404, CORS_HEADERS);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // 静态文件服务
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(DIST_DIR, filePath);

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, content2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content2);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

// 启动时检查是否需要备份
function checkAndBackup() {
  const backupFile = path.join(BACKUP_DIR, getBackupFilename());
  if (!fs.existsSync(backupFile)) {
    console.log('本周备份不存在，创建新备份...');
    doBackup();
  } else {
    console.log('本周备份已存在');
  }
}

// 打开浏览器（pkg 环境下尝试用系统命令打开）
function openBrowser(port) {
  const url = `http://localhost:${port}/`;
  if (process.platform === 'win32') {
    require('child_process').exec(`start "" "${url}"`);
  } else if (process.platform === 'darwin') {
    require('child_process').exec(`open "${url}"`);
  } else {
    require('child_process').exec(`xdg-open "${url}"`);
  }
}

// 启动服务器
const PORT = process.env.PORT || 3456;
server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('  理发会员管理系统');
  console.log('='.repeat(50));
  console.log('');
  console.log(`  数据目录 : ${DATA_DIR}`);
  console.log(`  备份目录 : ${BACKUP_DIR}`);
  console.log('');
  console.log(`  访问地址 : http://localhost:${PORT}/`);
  console.log('');
  console.log('  提示：请勿关闭此窗口');
  console.log('='.repeat(50));
  console.log('');

  // 自动打开浏览器
  try { openBrowser(PORT); } catch (e) {}

  // 检查备份
  checkAndBackup();
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

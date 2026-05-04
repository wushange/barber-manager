// 本地服务器版本数据库 - 使用 Node.js + JSON 文件存储

const API_BASE = '';

// 会员接口
export interface Member {
  id: number;
  name: string;
  phone: string;
  level: string;
  balance: number;
  created_at: string;
  last_visit?: string;
}

// 服务接口
export interface Service {
  id: number;
  name: string;
  price: number;
  category: string;
}

// 消费记录接口
export interface Record {
  id: number;
  member_id: number;
  member_name: string;
  service_id: number;
  service_name: string;
  amount: number;
  payment_method: string;
  note: string;
  created_at: string;
}

// API 请求辅助函数
async function apiGet(endpoint: string) {
  const res = await fetch(`${API_BASE}/api/${endpoint}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(endpoint: string, data: any) {
  const res = await fetch(`${API_BASE}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPut(endpoint: string, id: number, data: any) {
  const res = await fetch(`${API_BASE}/api/${endpoint}?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiDelete(endpoint: string, id: number) {
  const res = await fetch(`${API_BASE}/api/${endpoint}?id=${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 初始化（服务器会自动创建默认数据）
export function initDefaultData() {
  // 服务器会自动处理
}

// 获取所有会员
export async function getMembers(): Promise<Member[]> {
  return apiGet('members');
}

// 添加会员
export async function addMember(member: Omit<Member, 'id' | 'created_at'>): Promise<Member> {
  return apiPost('members', member);
}

// 更新会员
export async function updateMember(id: number, updates: Partial<Member>): Promise<Member | null> {
  return apiPut('members', id, updates);
}

// 删除会员
export async function deleteMember(id: number): Promise<boolean> {
  await apiDelete('members', id);
  return true;
}

// 通过手机尾号搜索会员
export async function searchMembersByPhone(phoneTail: string): Promise<Member[]> {
  const members = await getMembers();
  if (!phoneTail) return members;
  return members.filter(m => m.phone.endsWith(phoneTail));
}

// 获取所有服务
export async function getServices(): Promise<Service[]> {
  return apiGet('services');
}

// 添加服务
export async function addService(service: Omit<Service, 'id'>): Promise<Service> {
  return apiPost('services', service);
}

// 更新服务
export async function updateService(id: number, updates: Partial<Service>): Promise<Service | null> {
  return apiPut('services', id, updates);
}

// 删除服务
export async function deleteService(id: number): Promise<boolean> {
  await apiDelete('services', id);
  return true;
}

// 获取所有消费记录
export async function getRecords(): Promise<Record[]> {
  return apiGet('records');
}

// 添加消费记录
export async function addRecord(record: Omit<Record, 'id' | 'created_at'>): Promise<Record> {
  return apiPost('records', record);
}

// 删除消费记录
export async function deleteRecord(id: number): Promise<boolean> {
  await apiDelete('records', id);
  return true;
}

// 导出所有数据
export async function exportAllData() {
  const res = await fetch(`${API_BASE}/api/export`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `barber-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 导入数据
export async function importAllData(data: { members?: Member[], services?: Service[], records?: Record[] }) {
  return apiPost('import', data);
}

// 清空所有数据
export async function clearAllData() {
  return apiPost('clear', {});
}

// 手动备份
export async function doBackup(): Promise<{ success: boolean; file: string; message: string }> {
  return apiPost('backup', {});
}

// 获取备份列表
export async function getBackups(): Promise<{ name: string; path: string; time: string; size: number }[]> {
  return apiGet('backups');
}

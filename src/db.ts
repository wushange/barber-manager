// 纯网页版本数据库 - 使用 localStorage 存储

const DB_KEYS = {
  MEMBERS: 'bm_members',
  SERVICES: 'bm_services',
  RECORDS: 'bm_records',
};

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

// 初始化默认数据
export function initDefaultData() {
  if (!localStorage.getItem(DB_KEYS.SERVICES)) {
    const defaultServices: Service[] = [
      { id: 1, name: '洗剪吹', price: 35, category: '基础' },
      { id: 2, name: '单剪', price: 25, category: '基础' },
      { id: 3, name: '洗头', price: 15, category: '基础' },
      { id: 4, name: '染发', price: 128, category: '烫染' },
      { id: 5, name: '烫发', price: 168, category: '烫染' },
      { id: 6, name: '护理', price: 88, category: '护理' },
    ];
    localStorage.setItem(DB_KEYS.SERVICES, JSON.stringify(defaultServices));
  }
}

// 获取所有会员
export function getMembers(): Member[] {
  const data = localStorage.getItem(DB_KEYS.MEMBERS);
  return data ? JSON.parse(data) : [];
}

// 保存所有会员
export function saveMembers(members: Member[]) {
  localStorage.setItem(DB_KEYS.MEMBERS, JSON.stringify(members));
}

// 添加会员
export function addMember(member: Omit<Member, 'id' | 'created_at'>): Member {
  const members = getMembers();
  const newMember: Member = {
    ...member,
    id: Date.now(),
    created_at: new Date().toISOString(),
  };
  members.push(newMember);
  saveMembers(members);
  return newMember;
}

// 更新会员
export function updateMember(id: number, updates: Partial<Member>): Member | null {
  const members = getMembers();
  const index = members.findIndex(m => m.id === id);
  if (index === -1) return null;
  members[index] = { ...members[index], ...updates };
  saveMembers(members);
  return members[index];
}

// 删除会员
export function deleteMember(id: number): boolean {
  const members = getMembers();
  const filtered = members.filter(m => m.id !== id);
  if (filtered.length === members.length) return false;
  saveMembers(filtered);
  // 同时删除相关消费记录
  const records = getRecords();
  saveRecords(records.filter(r => r.member_id !== id));
  return true;
}

// 通过手机尾号搜索会员
export function searchMembersByPhone(phoneTail: string): Member[] {
  const members = getMembers();
  if (!phoneTail) return members;
  return members.filter(m => m.phone.endsWith(phoneTail));
}

// 获取所有服务
export function getServices(): Service[] {
  const data = localStorage.getItem(DB_KEYS.SERVICES);
  return data ? JSON.parse(data) : [];
}

// 保存所有服务
export function saveServices(services: Service[]) {
  localStorage.setItem(DB_KEYS.SERVICES, JSON.stringify(services));
}

// 添加服务
export function addService(service: Omit<Service, 'id'>): Service {
  const services = getServices();
  const newService: Service = {
    ...service,
    id: Date.now(),
  };
  services.push(newService);
  saveServices(services);
  return newService;
}

// 更新服务
export function updateService(id: number, updates: Partial<Service>): Service | null {
  const services = getServices();
  const index = services.findIndex(s => s.id === id);
  if (index === -1) return null;
  services[index] = { ...services[index], ...updates };
  saveServices(services);
  return services[index];
}

// 删除服务
export function deleteService(id: number): boolean {
  const services = getServices();
  const filtered = services.filter(s => s.id !== id);
  if (filtered.length === services.length) return false;
  saveServices(filtered);
  return true;
}

// 获取所有消费记录
export function getRecords(): Record[] {
  const data = localStorage.getItem(DB_KEYS.RECORDS);
  return data ? JSON.parse(data) : [];
}

// 保存所有消费记录
export function saveRecords(records: Record[]) {
  localStorage.setItem(DB_KEYS.RECORDS, JSON.stringify(records));
}

// 添加消费记录
export function addRecord(record: Omit<Record, 'id' | 'created_at'>): Record {
  const records = getRecords();
  const newRecord: Record = {
    ...record,
    id: Date.now(),
    created_at: new Date().toISOString(),
  };
  records.unshift(newRecord);
  saveRecords(records);

  // 更新会员最后访问时间
  updateMember(record.member_id, { last_visit: new Date().toISOString() });

  return newRecord;
}

// 删除消费记录
export function deleteRecord(id: number): boolean {
  const records = getRecords();
  const filtered = records.filter(r => r.id !== id);
  if (filtered.length === records.length) return false;
  saveRecords(filtered);
  return true;
}

// 导出所有数据
export function exportAllData() {
  return {
    members: getMembers(),
    services: getServices(),
    records: getRecords(),
    exportTime: new Date().toISOString(),
  };
}

// 导入数据
export function importAllData(data: { members?: Member[], services?: Service[], records?: Record[] }) {
  if (data.members) saveMembers(data.members);
  if (data.services) saveServices(data.services);
  if (data.records) saveRecords(data.records);
}

// 清空所有数据
export function clearAllData() {
  localStorage.removeItem(DB_KEYS.MEMBERS);
  localStorage.removeItem(DB_KEYS.SERVICES);
  localStorage.removeItem(DB_KEYS.RECORDS);
  initDefaultData();
}

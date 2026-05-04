import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as XLSX from "xlsx";
import "./App.css";

interface Member {
  id: number;
  name: string;
  phone: string;
  level: string;
  balance: number;
  created_at: string;
  last_visit?: string;
}

interface Service {
  id: number;
  name: string;
  price: number;
  category: string;
}

interface Record {
  id: number;
  member_name: string;
  service_name: string;
  amount: number;
  payment_method: string;
  note: string;
  created_at: string;
}

interface MemberFormData {
  id?: number;
  name: string;
  phone: string;
  level: string;
  balance: number;
}

interface RecordFormData {
  member_id: number;
  service_id: number;
  amount: number;
  payment_method: string;
  note: string;
}

interface ImportMember {
  name: string;
  phone: string;
  level?: string;
  balance?: number;
}

function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("members");
  
  // 收银页面状态
  const [searchPhoneTail, setSearchPhoneTail] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [checkoutServices, setCheckoutServices] = useState<{serviceId: number; price: number}[]>([]);
  const [checkoutPayment, setCheckoutPayment] = useState("余额");
  const [checkoutNote, setCheckoutNote] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutToast, setCheckoutToast] = useState<{type: "success"|"error"; msg: string} | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<{show: boolean; memberName: string; amount: number; balance: number; services: string[]} | null>(null);
  
  // 会员弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<MemberFormData>({
    name: "",
    phone: "",
    level: "普通",
    balance: 0,
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 消费记录弹窗状态
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordForm, setRecordForm] = useState<RecordFormData>({
    member_id: 0,
    service_id: 0,
    amount: 0,
    payment_method: "现金",
    note: "",
  });
  const [recordError, setRecordError] = useState("");
  const [submittingRecord, setSubmittingRecord] = useState(false);
  const [, setSelectedMemberId] = useState<number>(0);

  // 服务编辑状态
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    id: 0,
    name: "",
    price: 0,
    category: "剪发",
  });
  const [serviceError, setServiceError] = useState("");
  const [submittingService, setSubmittingService] = useState(false);
  const [editingService, setEditingService] = useState(false);

  // Excel导入状态
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importData, setImportData] = useState<string[][]>([]);
  const [importMapping, setImportMapping] = useState({
    nameCol: -1,
    phoneCol: -1,
    levelCol: -1,
    balanceCol: -1,
  });
  const [importPreview, setImportPreview] = useState<ImportMember[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  // 统计数据的状态
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalBalance: 0,
    todayIncome: 0,
    monthIncome: 0,
    activeMembers: 0,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [membersData, servicesData] = await Promise.all([
        invoke<Member[]>("get_members"),
        invoke<[number, string, number, string][]>("get_services"),
      ]);
      setMembers(membersData);
      // 将元组转换为对象
      const servicesObj: Service[] = servicesData.map(([id, name, price, category]) => ({
        id,
        name,
        price,
        category,
      }));
      setServices(servicesObj);
      calculateStats(membersData);
    } catch (error) {
      console.error("Failed to load initial data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers() {
    try {
      const data = await invoke<Member[]>("get_members");
      setMembers(data);
      calculateStats(data);
    } catch (error) {
      console.error("Failed to load members:", error);
    }
  }

  async function loadRecords() {
    try {
      const data = await invoke<[number, string, string, number, string, string, string][]>("get_records", { memberId: null });
      // 将元组转换为对象
      const recordsObj: Record[] = data.map(([id, member_name, service_name, amount, payment_method, note, created_at]) => ({
        id,
        member_name,
        service_name,
        amount,
        payment_method,
        note,
        created_at,
      }));
      setRecords(recordsObj);
    } catch (error) {
      console.error("Failed to load records:", error);
    }
  }

  function calculateStats(membersData: Member[]) {
    // const today = new Date().toISOString().split("T")[0];
    // const thisMonth = today.substring(0, 7);
    
    setStats({
      totalMembers: membersData.length,
      totalBalance: membersData.reduce((sum, m) => sum + m.balance, 0),
      todayIncome: 0, // 需要从records计算
      monthIncome: 0, // 需要从records计算
      activeMembers: membersData.filter(m => m.last_visit).length,
    });
  }

  // 会员表单处理函数
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "balance" ? Math.max(0, parseFloat(value) || 0) : value,
    }));
    setFormError("");
  }

  function openAddModal() {
    setIsEditing(false);
    setFormData({ name: "", phone: "", level: "普通", balance: 0 });
    setFormError("");
    setShowModal(true);
  }

  function openEditModal(member: Member) {
    setIsEditing(true);
    setFormData({
      id: member.id,
      name: member.name,
      phone: member.phone,
      level: member.level,
      balance: member.balance,
    });
    setFormError("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setFormError("请输入姓名");
      return;
    }
    if (!formData.phone.trim()) {
      setFormError("请输入手机号");
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      setFormError("手机号格式不正确");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && formData.id) {
        await invoke("update_member", {
          member: {
            id: formData.id,
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            level: formData.level,
            balance: formData.balance,
          },
        });
      } else {
        await invoke("add_member", {
          member: {
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            level: formData.level,
            balance: formData.balance,
          },
        });
      }
      
      setFormData({ name: "", phone: "", level: "普通", balance: 0 });
      setShowModal(false);
      await loadMembers();
    } catch (error: any) {
      if (error.includes("UNIQUE constraint failed")) {
        setFormError("该手机号已存在");
      } else {
        setFormError((isEditing ? "更新" : "添加") + "失败: " + error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // 消费记录处理函数
  function openRecordModal(memberId?: number) {
    setShowRecordModal(true);
    setRecordError("");
    setSelectedMemberId(memberId || 0);
    setRecordForm({
      member_id: memberId || 0,
      service_id: services.length > 0 ? services[0].id : 0,
      amount: 0,
      payment_method: "现金",
      note: "",
    });
  }

  function handleRecordInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setRecordForm(prev => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) || 0 : name === "member_id" || name === "service_id" ? parseInt(value) : value,
    }));
    if (name === "service_id") {
      const service = services.find(s => s.id === parseInt(value));
      if (service) {
        setRecordForm(prev => ({ ...prev, amount: service.price }));
      }
    }
    setRecordError("");
  }

  async function handleRecordSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (recordForm.member_id === 0) {
      setRecordError("请选择会员");
      return;
    }
    if (recordForm.service_id === 0) {
      setRecordError("请选择服务项目");
      return;
    }
    if (recordForm.amount <= 0) {
      setRecordError("金额必须大于0");
      return;
    }

    setSubmittingRecord(true);
    try {
      await invoke("add_record", {
        memberId: recordForm.member_id,
        serviceId: recordForm.service_id,
        amount: recordForm.amount,
        paymentMethod: recordForm.payment_method,
        note: recordForm.note || null,
      });
      
      setShowRecordModal(false);
      setRecordForm({
        member_id: 0,
        service_id: 0,
        amount: 0,
        payment_method: "现金",
        note: "",
      });
      
      // 刷新数据
      await Promise.all([loadMembers(), loadRecords()]);
    } catch (error: any) {
      setRecordError("添加记录失败: " + error);
    } finally {
      setSubmittingRecord(false);
    }
  }

  // Excel导入处理函数
  function openImportModal() {
    setShowImportModal(true);
    setImportStep(1);
    setImportHeaders([]);
    setImportData([]);
    setImportMapping({ nameCol: -1, phoneCol: -1, levelCol: -1, balanceCol: -1 });
    setImportPreview([]);
    setImportResult(null);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        if (jsonData.length < 2) {
          alert("Excel文件中没有足够的数据");
          return;
        }

        const headers = jsonData[0].map(h => String(h || ""));
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ""));
        
        setImportHeaders(headers);
        setImportData(rows);
        
        // 智能匹配列
        const mapping = {
          nameCol: findColumn(headers, ["姓名", "名字", "name", "客户姓名"]),
          phoneCol: findColumn(headers, ["手机号", "电话", "手机", "phone", "tel"]),
          levelCol: findColumn(headers, ["等级", "级别", "会员等级", "level"]),
          balanceCol: findColumn(headers, ["余额", "余额", "balance", "金额"]),
        };
        setImportMapping(mapping);
        
        setImportStep(2);
      } catch (error) {
        alert("读取Excel文件失败: " + error);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function findColumn(headers: string[], keywords: string[]): number {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      for (const keyword of keywords) {
        if (header.includes(keyword.toLowerCase())) {
          return i;
        }
      }
    }
    return -1;
  }

  function applyMapping() {
    if (importMapping.nameCol === -1 || importMapping.phoneCol === -1) {
      alert("请至少映射姓名和手机号列");
      return;
    }

    const preview: ImportMember[] = importData
      .filter(row => row[importMapping.nameCol] && row[importMapping.phoneCol])
      .slice(0, 10)
      .map(row => ({
        name: String(row[importMapping.nameCol]),
        phone: String(row[importMapping.phoneCol]),
        level: importMapping.levelCol >= 0 ? String(row[importMapping.levelCol] || "普通") : "普通",
        balance: importMapping.balanceCol >= 0 ? parseFloat(String(row[importMapping.balanceCol])) || 0 : 0,
      }));
    
    setImportPreview(preview);
    setImportStep(3);
  }

  async function handleImport() {
    setImporting(true);
    try {
      const membersToImport: ImportMember[] = importData
        .filter(row => row[importMapping.nameCol] && row[importMapping.phoneCol])
        .map(row => ({
          name: String(row[importMapping.nameCol]),
          phone: String(row[importMapping.phoneCol]),
          level: importMapping.levelCol >= 0 ? String(row[importMapping.levelCol] || "普通") : "普通",
          balance: importMapping.balanceCol >= 0 ? parseFloat(String(row[importMapping.balanceCol])) || 0 : 0,
        }));

      const result = await invoke<[number, number]>("batch_import_members", {
        members: membersToImport,
      });
      
      setImportResult({ imported: result[0], skipped: result[1] });
      setImportStep(4);
      await loadMembers();
    } catch (error) {
      alert("导入失败: " + error);
    } finally {
      setImporting(false);
    }
  }

  function closeImportModal() {
    setShowImportModal(false);
    setImportStep(1);
  }

  // 标签页切换
  function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (tab === "records") {
      loadRecords();
    }
  }

  function handleRefresh() {
    setLoading(true);
    if (activeTab === "members") {
      loadMembers();
    } else if (activeTab === "records") {
      loadRecords();
    } else {
      loadInitialData();
    }
  }

  // 收银页面函数
  async function handlePhoneSearch() {
    if (searchPhoneTail.length < 1) return;
    
    setSearching(true);
    setHasSearched(false);
    try {
      const results = await invoke<Member[]>("search_members_by_phone", {
        phoneTail: searchPhoneTail,
      });
      setSearchResults(results);
      setHasSearched(true);
      setSelectedMember(null);
      setCheckoutServices([]);
    } catch (error) {
      console.error("搜索失败:", error);
      setHasSearched(true);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleSelectMember(member: Member) {
    setSelectedMember(member);
    setCheckoutServices([]);
  }

  function handleAddServiceToCheckout(serviceId: number) {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    setCheckoutServices(prev => [...prev, { serviceId, price: service.price }]);
  }

  function handleRemoveServiceFromCheckout(index: number) {
    setCheckoutServices(prev => prev.filter((_, i) => i !== index));
  }

  function calculateTotal(): number {
    return checkoutServices.reduce((sum, item) => sum + item.price, 0);
  }

  function calculateDiscountedTotal(): number {
    if (!selectedMember) return calculateTotal();
    
    const discount = getDiscountRate(selectedMember.level);
    return calculateTotal() * discount;
  }

  function getDiscountRate(level: string): number {
    switch (level) {
      case "钻石": return 0.7;
      case "金卡": return 0.8;
      case "银卡": return 0.9;
      default: return 1.0;
    }
  }

  async function handleCheckout() {
    if (!selectedMember) return;
    if (checkoutServices.length === 0) {
      setCheckoutToast({ type: "error", msg: "请至少选择一个服务项目" });
      setTimeout(() => setCheckoutToast(null), 3000);
      return;
    }

    setCheckoutLoading(true);
    try {
      const totalAmount = calculateDiscountedTotal();
      
      // 为每个服务项目创建消费记录
      for (const item of checkoutServices) {
        await invoke("add_record", {
          memberId: selectedMember.id,
          serviceId: item.serviceId,
          amount: item.price,
          paymentMethod: checkoutPayment,
          note: checkoutNote || null,
        });
      }
      
      // 计算消费的服务名称列表
      const serviceNames = checkoutServices.map(item => {
        const service = services.find(s => s.id === item.serviceId);
        return service?.name || "";
      }).filter(Boolean);
      
      // 获取最新余额（如果是余额扣款，需要重新查询）
      let newBalance = selectedMember.balance;
      if (checkoutPayment === "余额") {
        newBalance = selectedMember.balance - totalAmount;
      }
      
      // 显示结账结果弹窗
      setCheckoutResult({
        show: true,
        memberName: selectedMember.name,
        amount: totalAmount,
        balance: newBalance,
        services: serviceNames
      });
      
      // 重置状态
      setSelectedMember(null);
      setCheckoutServices([]);
      setCheckoutNote("");
      setSearchPhoneTail("");
      setSearchResults([]);
      setHasSearched(false);
      
      // 刷新会员数据（余额可能已变化）
      await loadMembers();
    } catch (error: any) {
      setCheckoutToast({ type: "error", msg: "❌ 结账失败: " + error });
      setTimeout(() => setCheckoutToast(null), 4000);
    } finally {
      setCheckoutLoading(false);
    }
  }

  // 服务编辑函数
  function openAddServiceModal() {
    setEditingService(false);
    setServiceForm({ id: 0, name: "", price: 0, category: "剪发" });
    setServiceError("");
    setShowServiceModal(true);
  }

  function openEditServiceModal(service: Service) {
    setEditingService(true);
    setServiceForm({
      id: service.id,
      name: service.name,
      price: service.price,
      category: service.category,
    });
    setServiceError("");
    setShowServiceModal(true);
  }

  function handleServiceInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setServiceForm(prev => ({
      ...prev,
      [name]: name === "price" ? parseFloat(value) || 0 : value,
    }));
    setServiceError("");
  }

  async function handleServiceSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!serviceForm.name.trim()) {
      setServiceError("请输入服务名称");
      return;
    }
    if (serviceForm.price <= 0) {
      setServiceError("价格必须大于0");
      return;
    }

    setSubmittingService(true);
    try {
      if (editingService && serviceForm.id) {
        await invoke("update_service", {
          id: serviceForm.id,
          name: serviceForm.name.trim(),
          price: serviceForm.price,
          category: serviceForm.category,
        });
      } else {
        await invoke("add_service", {
          name: serviceForm.name.trim(),
          price: serviceForm.price,
          category: serviceForm.category,
        });
      }
      
      setShowServiceModal(false);
      await loadInitialData();
    } catch (error: any) {
      setServiceError((editingService ? "更新" : "添加") + "失败: " + error);
    } finally {
      setSubmittingService(false);
    }
  }

  async function handleDeleteService(id: number, name: string) {
    if (!confirm(`确定要删除服务项目 "${name}" 吗？`)) {
      return;
    }
    
    try {
      await invoke("delete_service", { id });
      await loadInitialData();
    } catch (error) {
      console.error("Failed to delete service:", error);
      alert("删除失败，可能该服务已被使用");
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>💈 理发管家</h1>
          <p className="header-subtitle">理发店会员管理系统</p>
        </div>
        <nav className="nav-tabs">
          <button className={activeTab === "checkout" ? "active" : ""} onClick={() => setActiveTab("checkout")}>
            💰 收银
          </button>
          <button className={activeTab === "members" ? "active" : ""} onClick={() => handleTabChange("members")}>
            👥 会员管理
          </button>
          <button className={activeTab === "records" ? "active" : ""} onClick={() => handleTabChange("records")}>
            📋 消费记录
          </button>
          <button className={activeTab === "stats" ? "active" : ""} onClick={() => handleTabChange("stats")}>
            📊 数据统计
          </button>
          <button className={activeTab === "settings" ? "active" : ""} onClick={() => handleTabChange("settings")}>
            ⚙️ 系统设置
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === "checkout" && (
          <div className="checkout-section">
            {/* Toast 通知 */}
            {checkoutToast && (
              <div className={`checkout-toast checkout-toast-${checkoutToast.type}`}>
                {checkoutToast.msg}
              </div>
            )}

            <div className="section-header">
              <div>
                <h2>收银结账</h2>
                <p className="section-desc">输入手机尾号搜索会员，快速结账</p>
              </div>
            </div>

            {/* 搜索框 */}
            <div className="search-box">
              <input
                type="text"
                placeholder="输入手机尾号（至少1位）"
                value={searchPhoneTail}
                onChange={(e) => {
                  setSearchPhoneTail(e.target.value.replace(/\D/g, ''));
                  setHasSearched(false);
                }}
                onKeyPress={(e) => e.key === 'Enter' && handlePhoneSearch()}
                maxLength={11}
              />
              <button
                className="btn btn-primary"
                onClick={handlePhoneSearch}
                disabled={searching || searchPhoneTail.length < 1}
              >
                {searching ? "搜索中..." : "🔍 搜索"}
              </button>
            </div>

            {/* 无结果提示 */}
            {hasSearched && searchResults.length === 0 && !selectedMember && (
              <div className="search-empty">
                <div className="search-empty-icon">🔍</div>
                <p>未找到手机尾号含 <strong>"{searchPhoneTail}"</strong> 的会员</p>
                <p className="search-empty-hint">请检查号码是否正确，或前往"会员管理"添加新会员</p>
              </div>
            )}

            {/* 搜索结果 */}
            {searchResults.length > 0 && !selectedMember && (
              <div className="search-results">
                <h3>搜索结果 ({searchResults.length} 人)，点击选择会员</h3>
                <div className="members-grid">
                  {searchResults.map(member => (
                    <div
                      key={member.id}
                      className="member-card"
                      onClick={() => handleSelectMember(member)}
                    >
                      <div className="member-card-name">{member.name}</div>
                      <div className="member-card-phone">{member.phone}</div>
                      <span className={`level-badge level-${member.level}`}>
                        {member.level}
                      </span>
                      <div className="member-card-balance">
                        余额: ¥{member.balance.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 选中的会员和结账区域 */}
            {selectedMember && (
              <div className="checkout-content">
                <div className="selected-member">
                  <div className="member-info">
                    <h3>{selectedMember.name}</h3>
                    <p>手机: {selectedMember.phone}</p>
                    <p>
                      等级:&nbsp;
                      <span className={`level-badge level-${selectedMember.level}`}>
                        {selectedMember.level}
                      </span>
                      {selectedMember.level !== "普通" && (
                        <span className="discount-info">
                          &nbsp;({(getDiscountRate(selectedMember.level) * 10).toFixed(1)}折)
                        </span>
                      )}
                    </p>
                    <p>余额: ¥{selectedMember.balance.toFixed(2)}</p>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedMember(null);
                      setCheckoutServices([]);
                    }}
                  >
                    重新选择
                  </button>
                </div>

                <div className="checkout-body">
                  {/* 服务项目选择 */}
                  <div className="services-select">
                    <h3>选择服务项目（可多选）</h3>
                    <div className="services-grid">
                      {services.map(service => (
                        <div
                          key={service.id}
                          className="service-card"
                          onClick={() => handleAddServiceToCheckout(service.id)}
                        >
                          <div className="service-name">{service.name}</div>
                          <div className="service-price">¥{service.price.toFixed(2)}</div>
                          <div className="service-category">{service.category}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 已选服务和结账 */}
                  <div className="checkout-summary">
                    <h3>结账明细</h3>
                    {checkoutServices.length === 0 ? (
                      <p className="empty-hint">← 点击左侧服务项目添加</p>
                    ) : (
                      <>
                        <div className="checkout-items">
                          {checkoutServices.map((item, index) => {
                            const service = services.find(s => s.id === item.serviceId);
                            return (
                              <div key={index} className="checkout-item">
                                <span className="item-name">{service?.name}</span>
                                <span className="item-price">¥{item.price.toFixed(2)}</span>
                                <button
                                  type="button"
                                  className="btn btn-small btn-danger"
                                  onClick={() => handleRemoveServiceFromCheckout(index)}
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <div className="checkout-total">
                          <div className="total-row">
                            <span>原价:</span>
                            <span>¥{calculateTotal().toFixed(2)}</span>
                          </div>
                          {selectedMember.level !== "普通" && (
                            <div className="total-row discount">
                              <span>折扣:</span>
                              <span>{(getDiscountRate(selectedMember.level) * 10).toFixed(1)}折</span>
                            </div>
                          )}
                          <div className="total-row final">
                            <span>实收:</span>
                            <span className="final-amount">¥{calculateDiscountedTotal().toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="checkout-payment">
                          <label>支付方式:</label>
                          <select
                            value={checkoutPayment}
                            onChange={(e) => setCheckoutPayment(e.target.value)}
                          >
                            <option value="现金">现金</option>
                            <option value="微信">微信</option>
                            <option value="支付宝">支付宝</option>
                            <option value="银行卡">银行卡</option>
                            <option value="余额">余额扣款</option>
                          </select>
                        </div>

                        <div className="checkout-note">
                          <label>备注:</label>
                          <input
                            type="text"
                            value={checkoutNote}
                            onChange={(e) => setCheckoutNote(e.target.value)}
                            placeholder="可选"
                          />
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary btn-large"
                          onClick={handleCheckout}
                          disabled={checkoutLoading}
                        >
                          {checkoutLoading ? "结账中..." : `✅ 确认结账  ¥${calculateDiscountedTotal().toFixed(2)}`}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === "members" && (
          <div className="members-section">
            <div className="section-header">
              <div>
                <h2>会员列表</h2>
                <p className="section-desc">管理店铺会员信息</p>
              </div>
              <div className="actions">
                <button className="btn btn-icon" onClick={handleRefresh} title="刷新">
                  🔄
                </button>
                <button className="btn btn-primary" onClick={openAddModal}>
                  ➕ 添加会员
                </button>
                <button className="btn btn-secondary" onClick={openImportModal}>
                  📥 导入Excel
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
                <p>加载中...</p>
              </div>
            ) : (
              <div className="members-table-container">
                <table className="members-table">
                  <thead>
                    <tr>
                      <th>姓名</th>
                      <th>手机号</th>
                      <th>会员等级</th>
                      <th>余额</th>
                      <th>注册时间</th>
                      <th>上次消费</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          <div className="empty-icon">📝</div>
                          <p>暂无会员数据</p>
                          <p className="empty-hint">点击"添加会员"或"导入Excel"开始录入</p>
                        </td>
                      </tr>
                    ) : (
                      members.map((member) => (
                        <tr key={member.id}>
                          <td className="name-cell">{member.name}</td>
                          <td className="phone-cell">{member.phone}</td>
                          <td>
                            <span className={`level-badge level-${member.level}`}>
                              {member.level}
                            </span>
                          </td>
                          <td className="balance">¥{member.balance.toFixed(2)}</td>
                          <td>{new Date(member.created_at).toLocaleDateString()}</td>
                          <td>
                            {member.last_visit
                              ? new Date(member.last_visit).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="actions-cell">
                            <button 
                              type="button"
                              className="btn btn-small" 
                              onClick={function() { openEditModal(member); }}
                            >
                              编辑
                            </button>
                            <button 
                              type="button"
                              className="btn btn-small btn-danger" 
                              onClick={function() { 
                                console.log("删除点击", member.id);
                                if (confirm("确定删除 " + member.name + "？")) {
                                  invoke("delete_member", { id: member.id })
                                    .then(() => {
                                      alert("删除成功");
                                      loadMembers();
                                    })
                                    .catch(err => {
                                      alert("删除失败: " + err);
                                    });
                                }
                              }}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "records" && (
          <div className="records-section">
            <div className="section-header">
              <div>
                <h2>消费记录</h2>
                <p className="section-desc">查看和管理消费记录</p>
              </div>
              <div className="actions">
                <button className="btn btn-icon" onClick={handleRefresh} title="刷新">
                  🔄
                </button>
                <button className="btn btn-primary" onClick={() => openRecordModal()}>
                  ➕ 添加消费记录
                </button>
              </div>
            </div>

            <div className="records-table-container">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>会员</th>
                    <th>服务项目</th>
                    <th>金额</th>
                    <th>支付方式</th>
                    <th>备注</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        <div className="empty-icon">📋</div>
                        <p>暂无消费记录</p>
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id}>
                        <td>{record.member_name}</td>
                        <td>{record.service_name}</td>
                        <td className="amount">¥{record.amount.toFixed(2)}</td>
                        <td>{record.payment_method}</td>
                        <td>{record.note || "-"}</td>
                        <td>{new Date(record.created_at).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="stats-section">
            <h2>数据统计</h2>
            <div className="stats-cards">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-value">{stats.totalMembers}</div>
                <div className="stat-label">总会员数</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-value">¥{stats.totalBalance.toFixed(2)}</div>
                <div className="stat-label">会员总余额</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-value">{stats.activeMembers}</div>
                <div className="stat-label">活跃会员</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💳</div>
                <div className="stat-value">{services.length}</div>
                <div className="stat-label">服务项目</div>
              </div>
            </div>

            <div className="stats-detail">
              <h3>会员等级分布</h3>
              <div className="level-stats">
                {["普通", "银卡", "金卡", "钻石"].map(level => {
                  const count = members.filter(m => m.level === level).length;
                  const percentage = stats.totalMembers > 0 ? (count / stats.totalMembers * 100).toFixed(1) : "0";
                  return (
                    <div key={level} className="level-stat-item">
                      <span className={`level-badge level-${level}`}>{level}</span>
                      <span className="level-count">{count}人</span>
                      <div className="level-bar">
                        <div className="level-bar-fill" style={{ width: `${percentage}%` }}></div>
                      </div>
                      <span className="level-percentage">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="settings-section">
            <div className="section-header">
              <div>
                <h2>系统设置</h2>
                <p className="section-desc">管理服务项目和其他设置</p>
              </div>
              <button className="btn btn-primary" onClick={openAddServiceModal}>
                ➕ 添加服务
              </button>
            </div>
            <div className="settings-content">
              <div className="setting-group">
                <h3>服务项目</h3>
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>价格</th>
                      <th>分类</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="empty-state">
                          <p>暂无服务项目</p>
                        </td>
                      </tr>
                    ) : (
                      services.map(service => (
                        <tr key={service.id}>
                          <td>{service.name}</td>
                          <td>¥{service.price.toFixed(2)}</td>
                          <td>{service.category}</td>
                          <td className="actions-cell">
                            <button 
                              type="button"
                              className="btn btn-small" 
                              onClick={() => {
                                console.log("Edit service clicked:", service.id);
                                openEditServiceModal(service);
                              }}
                            >
                              编辑
                            </button>
                            <button 
                              type="button"
                              className="btn btn-small btn-danger" 
                              onClick={() => {
                                console.log("Delete service clicked:", service.id);
                                handleDeleteService(service.id, service.name);
                              }}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 添加/编辑会员弹窗 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditing ? "编辑会员" : "添加新会员"}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && <div className="form-error">{formError}</div>}
                
                <div className="form-group">
                  <label>姓名 <span className="required">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="请输入会员姓名"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>手机号 <span className="required">*</span></label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="请输入11位手机号"
                    maxLength={11}
                    disabled={isEditing}
                  />
                  {isEditing && <small className="form-hint">编辑时不能修改手机号</small>}
                </div>

                <div className="form-group">
                  <label>会员等级</label>
                  <select name="level" value={formData.level} onChange={handleInputChange}>
                    <option value="普通">普通</option>
                    <option value="银卡">银卡</option>
                    <option value="金卡">金卡</option>
                    <option value="钻石">钻石</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>余额</label>
                  <div className="balance-input">
                    <span className="balance-prefix">¥</span>
                    <input
                      type="number"
                      name="balance"
                      value={formData.balance}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <small className="form-hint">余额不能小于0</small>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "保存中..." : (isEditing ? "更新" : "保存")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 添加消费记录弹窗 */}
      {showRecordModal && (
        <div className="modal-overlay" onClick={() => setShowRecordModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加消费记录</h3>
              <button className="modal-close" onClick={() => setShowRecordModal(false)}>✕</button>
            </div>
            <form onSubmit={handleRecordSubmit}>
              <div className="modal-body">
                {recordError && <div className="form-error">{recordError}</div>}
                
                <div className="form-group">
                  <label>会员 <span className="required">*</span></label>
                  <select
                    name="member_id"
                    value={recordForm.member_id || ""}
                    onChange={handleRecordInputChange}
                  >
                    <option value="">请选择会员</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>服务项目 <span className="required">*</span></label>
                  <select
                    name="service_id"
                    value={recordForm.service_id || ""}
                    onChange={handleRecordInputChange}
                  >
                    <option value="">请选择服务项目</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} - ¥{s.price.toFixed(2)}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>金额 <span className="required">*</span></label>
                  <div className="balance-input">
                    <span className="balance-prefix">¥</span>
                    <input
                      type="number"
                      name="amount"
                      value={recordForm.amount}
                      onChange={handleRecordInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>支付方式</label>
                  <select name="payment_method" value={recordForm.payment_method} onChange={handleRecordInputChange}>
                    <option value="现金">现金</option>
                    <option value="微信">微信</option>
                    <option value="支付宝">支付宝</option>
                    <option value="银行卡">银行卡</option>
                    <option value="余额">余额扣款</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>备注</label>
                  <input
                    type="text"
                    name="note"
                    value={recordForm.note}
                    onChange={handleRecordInputChange}
                    placeholder="可选"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRecordModal(false)} disabled={submittingRecord}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingRecord}>
                  {submittingRecord ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 服务编辑弹窗 */}
      {showServiceModal && (
        <div className="modal-overlay" onClick={() => setShowServiceModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingService ? "编辑服务" : "添加新服务"}</h3>
              <button className="modal-close" onClick={() => setShowServiceModal(false)}>✕</button>
            </div>
            <form onSubmit={handleServiceSubmit}>
              <div className="modal-body">
                {serviceError && <div className="form-error">{serviceError}</div>}
                
                <div className="form-group">
                  <label>服务名称 <span className="required">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={serviceForm.name}
                    onChange={handleServiceInputChange}
                    placeholder="如：洗剪吹"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>价格 <span className="required">*</span></label>
                  <div className="balance-input">
                    <span className="balance-prefix">¥</span>
                    <input
                      type="number"
                      name="price"
                      value={serviceForm.price}
                      onChange={handleServiceInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>分类</label>
                  <select name="category" value={serviceForm.category} onChange={handleServiceInputChange}>
                    <option value="剪发">剪发</option>
                    <option value="烫染">烫染</option>
                    <option value="护理">护理</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowServiceModal(false)} disabled={submittingService}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingService}>
                  {submittingService ? "保存中..." : (editingService ? "更新" : "保存")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 结账成功弹窗 */}
      {checkoutResult?.show && (
        <div className="modal-overlay" onClick={() => setCheckoutResult(null)}>
          <div className="modal checkout-result-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ 结账成功</h3>
              <button className="modal-close" onClick={() => setCheckoutResult(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="checkout-result-content">
                <div className="result-member">
                  <span className="result-label">会员:</span>
                  <span className="result-value">{checkoutResult.memberName}</span>
                </div>
                <div className="result-services">
                  <span className="result-label">消费项目:</span>
                  <span className="result-value">{checkoutResult.services.join("、")}</span>
                </div>
                <div className="result-amount">
                  <span className="result-label">实付金额:</span>
                  <span className="result-value amount">¥{checkoutResult.amount.toFixed(2)}</span>
                </div>
                <div className="result-balance">
                  <span className="result-label">当前余额:</span>
                  <span className="result-value balance">¥{checkoutResult.balance.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setCheckoutResult(null)}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel导入弹窗 */}
      {showImportModal && (
        <div className="modal-overlay" onClick={closeImportModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>导入Excel - 步骤{importStep}/4</h3>
              <button className="modal-close" onClick={closeImportModal}>✕</button>
            </div>
            <div className="modal-body">
              {/* 步骤1: 上传文件 */}
              {importStep === 1 && (
                <div className="import-step">
                  <div className="import-upload-area">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      id="excel-upload"
                      style={{ display: "none" }}
                    />
                    <label htmlFor="excel-upload" className="import-upload-label">
                      <div className="upload-icon">📁</div>
                      <p>点击上传Excel文件</p>
                      <p className="upload-hint">支持 .xlsx, .xls, .csv 格式</p>
                    </label>
                  </div>
                </div>
              )}

              {/* 步骤2: 列映射 */}
              {importStep === 2 && (
                <div className="import-step">
                  <h4>列映射</h4>
                  <p className="import-hint">请确认Excel列与会员字段的对应关系</p>
                  
                  <div className="mapping-table">
                    <div className="mapping-row">
                      <span className="mapping-label">姓名列 <span className="required">*</span></span>
                      <select
                        value={importMapping.nameCol}
                        onChange={(e) => setImportMapping(prev => ({ ...prev, nameCol: parseInt(e.target.value) }))}
                      >
                        <option value="-1">请选择</option>
                        {importHeaders.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mapping-row">
                      <span className="mapping-label">手机号列 <span className="required">*</span></span>
                      <select
                        value={importMapping.phoneCol}
                        onChange={(e) => setImportMapping(prev => ({ ...prev, phoneCol: parseInt(e.target.value) }))}
                      >
                        <option value="-1">请选择</option>
                        {importHeaders.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mapping-row">
                      <span className="mapping-label">等级列</span>
                      <select
                        value={importMapping.levelCol}
                        onChange={(e) => setImportMapping(prev => ({ ...prev, levelCol: parseInt(e.target.value) }))}
                      >
                        <option value="-1">无</option>
                        {importHeaders.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mapping-row">
                      <span className="mapping-label">余额列</span>
                      <select
                        value={importMapping.balanceCol}
                        onChange={(e) => setImportMapping(prev => ({ ...prev, balanceCol: parseInt(e.target.value) }))}
                      >
                        <option value="-1">无</option>
                        {importHeaders.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="import-preview-table">
                    <h4>数据预览（前5行）</h4>
                    <table>
                      <thead>
                        <tr>
                          {importHeaders.map((h, i) => (
                            <th key={i}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 5).map((row, ri) => (
                          <tr key={ri}>
                            {importHeaders.map((_, ci) => (
                              <td key={ci}>{row[ci] || ""}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setImportStep(1)}>
                      上一步
                    </button>
                    <button type="button" className="btn btn-primary" onClick={applyMapping}>
                      下一步
                    </button>
                  </div>
                </div>
              )}

              {/* 步骤3: 预览确认 */}
              {importStep === 3 && (
                <div className="import-step">
                  <h4>预览确认</h4>
                  <p>共 {importData.length} 条数据，预览前10条：</p>
                  
                  <div className="preview-table">
                    <table>
                      <thead>
                        <tr>
                          <th>姓名</th>
                          <th>手机号</th>
                          <th>等级</th>
                          <th>余额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((m, i) => (
                          <tr key={i}>
                            <td>{m.name}</td>
                            <td>{m.phone}</td>
                            <td>{m.level}</td>
                            <td>¥{(m.balance || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setImportStep(2)}>
                      上一步
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleImport} disabled={importing}>
                      {importing ? "导入中..." : "确认导入"}
                    </button>
                  </div>
                </div>
              )}

              {/* 步骤4: 导入结果 */}
              {importStep === 4 && importResult && (
                <div className="import-step">
                  <div className="import-result">
                    <div className="result-icon">✅</div>
                    <h4>导入完成</h4>
                    <p>成功导入 <strong>{importResult.imported}</strong> 条数据</p>
                    {importResult.skipped > 0 && (
                      <p className="import-skipped">跳过 <strong>{importResult.skipped}</strong> 条（手机号为空或已存在）</p>
                    )}
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-primary" onClick={closeImportModal}>
                      完成
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

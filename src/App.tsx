import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "./App.css";
import {
  initDefaultData,
  getMembers,
  addMember,
  updateMember,
  deleteMember,
  searchMembersByPhone,
  getServices,
  addService,
  updateService,
  deleteService,
  getRecords,
  addRecord,
  deleteRecord,
  exportAllData,
  importAllData,
  clearAllData,
  Member,
  Service,
  Record,
} from "./db";

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

  // 服务管理弹窗状态
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [isEditingService, setIsEditingService] = useState(false);
  const [serviceForm, setServiceForm] = useState<Partial<Service>>({
    name: "",
    price: 0,
    category: "基础",
  });
  const [serviceError, setServiceError] = useState("");
  const [submittingService, setSubmittingService] = useState(false);

  // Excel导入状态
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "mapping" | "preview" | "result">("upload");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importMapping, setImportMapping] = useState<{name: string; phone: string; level: string; balance: string}>({
    name: "",
    phone: "",
    level: "",
    balance: "",
  });
  const [importPreview, setImportPreview] = useState<ImportMember[]>([]);
  const [importResult, setImportResult] = useState<{success: number; skipped: number; errors: string[]} | null>(null);
  const [importing, setImporting] = useState(false);

  // 初始化数据
  useEffect(() => {
    initDefaultData();
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [m, s, r] = await Promise.all([
        getMembers(),
        getServices(),
        getRecords(),
      ]);
      setMembers(m);
      setServices(s);
      setRecords(r);
    } catch (error) {
      console.error("加载数据失败:", error);
      alert("连接服务器失败，请确保服务器已启动");
    } finally {
      setLoading(false);
    }
  }

  // 统计数据
  const stats = {
    totalMembers: members.length,
    totalBalance: members.reduce((sum, m) => sum + (m.balance || 0), 0),
    todayRecords: records.filter(r => {
      const recordDate = new Date(r.created_at).toDateString();
      const today = new Date().toDateString();
      return recordDate === today;
    }).length,
    totalRecords: records.length,
  };

  // 会员等级分布
  const levelStats = {
    普通: members.filter(m => m.level === "普通").length,
    银卡: members.filter(m => m.level === "银卡").length,
    金卡: members.filter(m => m.level === "金卡").length,
    钻石: members.filter(m => m.level === "钻石").length,
  };

  // 打开添加会员弹窗
  function openAddModal() {
    setIsEditing(false);
    setFormData({ name: "", phone: "", level: "普通", balance: 0 });
    setFormError("");
    setShowModal(true);
  }

  // 打开编辑会员弹窗
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

  // 提交会员表单
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formData.name.trim()) {
      setFormError("请输入会员姓名");
      return;
    }
    if (!formData.phone.trim()) {
      setFormError("请输入手机号");
      return;
    }

    setSubmitting(true);

    try {
      if (isEditing && formData.id) {
        await updateMember(formData.id, formData);
      } else {
        // 检查手机号是否已存在
        const existing = members.find(m => m.phone === formData.phone);
        if (existing) {
          setFormError("该手机号已存在");
          setSubmitting(false);
          return;
        }
        await addMember(formData);
      }
      await loadData();
      setShowModal(false);
    } catch (error) {
      setFormError("操作失败: " + String(error));
    } finally {
      setSubmitting(false);
    }
  }

  // 删除会员
  async function handleDelete(id: number) {
    if (!confirm("确定要删除该会员吗？此操作不可恢复。")) return;

    try {
      await deleteMember(id);
      await loadData();
    } catch (error) {
      alert("删除失败: " + String(error));
    }
  }

  // 打开添加消费记录弹窗
  function openAddRecordModal() {
    setRecordForm({
      member_id: 0,
      service_id: 0,
      amount: 0,
      payment_method: "现金",
      note: "",
    });
    setRecordError("");
    setShowRecordModal(true);
  }

  // 提交消费记录
  async function handleRecordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRecordError("");

    if (!recordForm.member_id) {
      setRecordError("请选择会员");
      return;
    }
    if (!recordForm.service_id) {
      setRecordError("请选择服务项目");
      return;
    }
    if (recordForm.amount <= 0) {
      setRecordError("请输入有效金额");
      return;
    }

    setSubmittingRecord(true);

    try {
      const member = members.find(m => m.id === recordForm.member_id);
      const service = services.find(s => s.id === recordForm.service_id);

      if (!member || !service) {
        setRecordError("会员或服务不存在");
        setSubmittingRecord(false);
        return;
      }

      await addRecord({
        member_id: recordForm.member_id,
        member_name: member.name,
        service_id: recordForm.service_id,
        service_name: service.name,
        amount: recordForm.amount,
        payment_method: recordForm.payment_method,
        note: recordForm.note,
      });

      await loadData();
      setShowRecordModal(false);
    } catch (error) {
      setRecordError("添加失败: " + String(error));
    } finally {
      setSubmittingRecord(false);
    }
  }

  // 删除消费记录
  async function handleDeleteRecord(id: number) {
    if (!confirm("确定要删除该记录吗？")) return;

    try {
      await deleteRecord(id);
      await loadData();
    } catch (error) {
      alert("删除失败: " + String(error));
    }
  }

  // 打开添加服务弹窗
  function openAddServiceModal() {
    setIsEditingService(false);
    setServiceForm({ name: "", price: 0, category: "基础" });
    setServiceError("");
    setShowServiceModal(true);
  }

  // 打开编辑服务弹窗
  function openEditServiceModal(service: Service) {
    setIsEditingService(true);
    setServiceForm({ ...service });
    setServiceError("");
    setShowServiceModal(true);
  }

  // 提交服务表单
  async function handleServiceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServiceError("");

    if (!serviceForm.name?.trim()) {
      setServiceError("请输入服务名称");
      return;
    }
    if (!serviceForm.price || serviceForm.price <= 0) {
      setServiceError("请输入有效价格");
      return;
    }

    setSubmittingService(true);

    try {
      if (isEditingService && serviceForm.id) {
        await updateService(serviceForm.id, serviceForm);
      } else {
        await addService(serviceForm as Omit<Service, 'id'>);
      }
      await loadData();
      setShowServiceModal(false);
    } catch (error) {
      setServiceError("操作失败: " + String(error));
    } finally {
      setSubmittingService(false);
    }
  }

  // 删除服务
  async function handleDeleteService(id: number) {
    if (!confirm("确定要删除该服务吗？")) return;

    try {
      await deleteService(id);
      await loadData();
    } catch (error) {
      alert("删除失败: " + String(error));
    }
  }

  // 处理Excel文件上传
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      setImportData(jsonData);

      // 自动映射字段
      const firstRow = jsonData[0] as any;
      const columns = Object.keys(firstRow || {});
      const mapping = {
        name: columns.find(c => c.includes("姓名") || c.toLowerCase().includes("name")) || columns[0] || "",
        phone: columns.find(c => c.includes("手机") || c.includes("电话") || c.toLowerCase().includes("phone")) || columns[1] || "",
        level: columns.find(c => c.includes("等级") || c.includes("级别") || c.toLowerCase().includes("level")) || "",
        balance: columns.find(c => c.includes("余额") || c.includes("金额") || c.toLowerCase().includes("balance")) || "",
      };
      setImportMapping(mapping);
      setImportStep("mapping");
    };
    reader.readAsArrayBuffer(file);
  }

  // 预览导入数据
  function previewImport() {
    const preview: ImportMember[] = importData.map((row: any) => ({
      name: row[importMapping.name]?.toString().trim() || "",
      phone: row[importMapping.phone]?.toString().trim() || "",
      level: row[importMapping.level]?.toString().trim() || "普通",
      balance: parseFloat(row[importMapping.balance]) || 0,
    })).filter(m => m.name && m.phone);

    setImportPreview(preview);
    setImportStep("preview");
  }

  // 执行导入
  async function executeImport() {
    setImporting(true);
    let success = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const member of importPreview) {
      try {
        const existing = members.find(m => m.phone === member.phone);
        if (existing) {
          skipped++;
          continue;
        }
        await addMember(member);
        success++;
      } catch (error) {
        errors.push(`${member.name}: ${String(error)}`);
      }
    }

    setImportResult({ success, skipped, errors });
    setImporting(false);
    setImportStep("result");
    await loadData();
  }

  // 导出数据
  async function exportData() {
    await exportAllData();
  }

  // 导入数据
  async function importDataFromFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        await importAllData(data);
        await loadData();
        alert("数据导入成功！");
      } catch (error) {
        alert("导入失败: " + String(error));
      }
    };
    reader.readAsText(file);
  }

  // 清空所有数据
  async function handleClearAll() {
    if (!confirm("⚠️ 警告：这将清空所有数据，包括会员、服务和消费记录！\n\n确定要继续吗？")) return;
    if (!confirm("再次确认：真的要清空所有数据吗？此操作不可恢复！")) return;

    await clearAllData();
    await loadData();
    alert("所有数据已清空！");
  }

  // 收银页面搜索
  async function handlePhoneSearch() {
    setSearching(true);
    setHasSearched(false);

    try {
      const results = await searchMembersByPhone(searchPhoneTail);
      setSearchResults(results);
      setHasSearched(true);
    } catch (error) {
      console.error("搜索失败:", error);
    } finally {
      setSearching(false);
    }
  }

  // 选择会员
  function selectMemberForCheckout(member: Member) {
    setSelectedMember(member);
    setCheckoutServices([]);
    setCheckoutNote("");
  }

  // 添加服务到结账
  function addServiceToCheckout(service: Service) {
    const discountRate = getDiscountRate(selectedMember?.level || "");
    const discountedPrice = Math.round(service.price * discountRate * 100) / 100;

    setCheckoutServices([...checkoutServices, {
      serviceId: service.id,
      price: discountedPrice,
    }]);
  }

  // 移除结账服务
  function removeCheckoutService(index: number) {
    setCheckoutServices(checkoutServices.filter((_, i) => i !== index));
  }

  // 获取折扣率
  function getDiscountRate(level: string): number {
    switch (level) {
      case "钻石": return 0.7;
      case "金卡": return 0.8;
      case "银卡": return 0.9;
      default: return 1.0;
    }
  }

  // 获取服务名称
  function getServiceName(serviceId: number): string {
    const service = services.find(s => s.id === serviceId);
    return service?.name || "未知服务";
  }

  // 获取服务原价
  function getServiceOriginalPrice(serviceId: number): number {
    const service = services.find(s => s.id === serviceId);
    return service?.price || 0;
  }

  // 计算总价
  const totalAmount = checkoutServices.reduce((sum, item) => sum + item.price, 0);
  const originalAmount = checkoutServices.reduce((sum, item) => sum + getServiceOriginalPrice(item.serviceId), 0);
  const discountAmount = originalAmount - totalAmount;

  // 执行结账
  async function executeCheckout() {
    if (!selectedMember || checkoutServices.length === 0) return;

    setCheckoutLoading(true);

    try {
      // 如果是余额支付，检查余额是否足够
      if (checkoutPayment === "余额" && selectedMember.balance < totalAmount) {
        setCheckoutToast({
          type: "error",
          msg: `❌ 余额不足！当前余额 ¥${selectedMember.balance.toFixed(2)}，需要 ¥${totalAmount.toFixed(2)}`
        });
        setTimeout(() => setCheckoutToast(null), 4000);
        setCheckoutLoading(false);
        return;
      }

      // 创建消费记录
      for (const item of checkoutServices) {
        const service = services.find(s => s.id === item.serviceId);
        if (!service) continue;

        await addRecord({
          member_id: selectedMember.id,
          member_name: selectedMember.name,
          service_id: item.serviceId,
          service_name: service.name,
          amount: item.price,
          payment_method: checkoutPayment,
          note: checkoutNote,
        });
      }

      // 如果是余额支付，扣除余额
      let newBalance = selectedMember.balance;
      if (checkoutPayment === "余额") {
        newBalance = selectedMember.balance - totalAmount;
        await updateMember(selectedMember.id, { balance: newBalance });
      }

      // 计算消费的服务名称列表
      const serviceNames = checkoutServices.map(item => {
        const service = services.find(s => s.id === item.serviceId);
        return service?.name || "";
      }).filter(Boolean);

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

      // 刷新数据
      await loadData();
    } catch (error) {
      setCheckoutToast({
        type: "error",
        msg: "❌ 结账失败: " + String(error)
      });
      setTimeout(() => setCheckoutToast(null), 4000);
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Toast 提示 */}
      {checkoutToast && (
        <div className={`checkout-toast checkout-toast-${checkoutToast.type}`}>
          {checkoutToast.msg}
        </div>
      )}

      <header className="app-header">
        <div className="header-content">
          <h1>💈 理发会员管理系统</h1>
          <p className="header-subtitle">Web版本 - 数据存储在浏览器本地</p>
        </div>
        <nav className="nav-tabs">
          <button className={activeTab === "checkout" ? "active" : ""} onClick={() => setActiveTab("checkout")}>
            💰 收银
          </button>
          <button className={activeTab === "members" ? "active" : ""} onClick={() => setActiveTab("members")}>
            👥 会员管理
          </button>
          <button className={activeTab === "records" ? "active" : ""} onClick={() => setActiveTab("records")}>
            📋 消费记录
          </button>
          <button className={activeTab === "services" ? "active" : ""} onClick={() => setActiveTab("services")}>
            ✂️ 服务管理
          </button>
          <button className={activeTab === "stats" ? "active" : ""} onClick={() => setActiveTab("stats")}>
            📊 数据统计
          </button>
          <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}>
            ⚙️ 设置
          </button>
        </nav>
      </header>

      <main className="app-main">
        {/* 收银页面 */}
        {activeTab === "checkout" && (
          <div className="checkout-section">
            <div className="section-header">
              <div>
                <h2>💰 收银台</h2>
                <p className="section-desc">通过手机尾号搜索会员，快速结账</p>
              </div>
            </div>

            {/* 搜索框 */}
            <div className="search-box">
              <input
                type="text"
                placeholder="输入手机尾号（如：8888）"
                value={searchPhoneTail}
                onChange={(e) => setSearchPhoneTail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneSearch()}
                maxLength={11}
              />
              <button
                className="btn btn-primary"
                onClick={handlePhoneSearch}
                disabled={searching}
              >
                {searching ? "搜索中..." : "🔍 搜索"}
              </button>
            </div>

            {/* 搜索结果 */}
            {hasSearched && searchResults.length === 0 && (
              <div className="search-empty">
                <div className="search-empty-icon">😕</div>
                <p>未找到会员</p>
                <p className="search-empty-hint">请检查手机尾号是否正确</p>
              </div>
            )}

            {searchResults.length > 0 && !selectedMember && (
              <div className="search-results">
                <h3>搜索结果（点击选择）</h3>
                <div className="members-grid">
                  {searchResults.map((member) => (
                    <div
                      key={member.id}
                      className="member-card"
                      onClick={() => selectMemberForCheckout(member)}
                    >
                      <div className="member-card-name">{member.name}</div>
                      <div className="member-card-phone">{member.phone}</div>
                      <span className={`level-badge level-${member.level}`}>{member.level}</span>
                      <div className="member-card-balance">余额: ¥{member.balance.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 结账区域 */}
            {selectedMember && (
              <div className="checkout-content">
                <div className="selected-member">
                  <div className="member-info">
                    <h3>{selectedMember.name}</h3>
                    <p>📱 {selectedMember.phone}</p>
                    <p>
                      🏷️ {selectedMember.level}会员
                      {selectedMember.level !== "普通" && (
                        <span className="discount-info">
                          ({getDiscountRate(selectedMember.level) * 10}折)
                        </span>
                      )}
                    </p>
                    <p>💰 余额: ¥{selectedMember.balance.toFixed(2)}</p>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSelectedMember(null)}
                  >
                    重新选择
                  </button>
                </div>

                <div className="checkout-body">
                  {/* 服务选择 */}
                  <div className="services-select">
                    <h3>选择服务</h3>
                    <div className="services-grid">
                      {services.map((service) => (
                        <div
                          key={service.id}
                          className="service-card"
                          onClick={() => addServiceToCheckout(service)}
                        >
                          <div className="service-name">{service.name}</div>
                          <div className="service-price">
                            ¥{Math.round(service.price * getDiscountRate(selectedMember.level) * 100) / 100}
                            {selectedMember.level !== "普通" && (
                              <span style={{ textDecoration: "line-through", color: "#999", fontSize: "0.8rem", marginLeft: "4px" }}>
                                ¥{service.price}
                              </span>
                            )}
                          </div>
                          <div className="service-category">{service.category}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 结账明细 */}
                  <div className="checkout-summary">
                    <h3>结账明细</h3>
                    <div className="checkout-items">
                      {checkoutServices.length === 0 ? (
                        <p className="empty-hint">请点击左侧服务添加到此处</p>
                      ) : (
                        checkoutServices.map((item, index) => (
                          <div key={index} className="checkout-item">
                            <span className="item-name">{getServiceName(item.serviceId)}</span>
                            <span className="item-price">¥{item.price.toFixed(2)}</span>
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => removeCheckoutService(index)}
                            >
                              删除
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="checkout-total">
                      <div className="total-row">
                        <span>原价:</span>
                        <span>¥{originalAmount.toFixed(2)}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="total-row discount">
                          <span>优惠:</span>
                          <span>-¥{discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="total-row final">
                        <span>应付:</span>
                        <span className="final-amount">¥{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="checkout-payment">
                      <label>支付方式</label>
                      <select
                        value={checkoutPayment}
                        onChange={(e) => setCheckoutPayment(e.target.value)}
                      >
                        <option value="余额">💳 余额</option>
                        <option value="现金">💵 现金</option>
                        <option value="微信">📱 微信</option>
                        <option value="支付宝">🔵 支付宝</option>
                        <option value="刷卡">💳 刷卡</option>
                      </select>
                    </div>

                    <div className="checkout-note">
                      <label>备注</label>
                      <input
                        type="text"
                        placeholder="可选"
                        value={checkoutNote}
                        onChange={(e) => setCheckoutNote(e.target.value)}
                      />
                    </div>

                    <button
                      className="btn btn-primary btn-large"
                      onClick={executeCheckout}
                      disabled={checkoutServices.length === 0 || checkoutLoading}
                    >
                      {checkoutLoading ? "处理中..." : "✅ 确认结账"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 会员管理页面 */}
        {activeTab === "members" && (
          <>
            <div className="section-header">
              <div>
                <h2>👥 会员管理</h2>
                <p className="section-desc">共 {members.length} 位会员</p>
              </div>
              <div className="actions">
                <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
                  📥 Excel导入
                </button>
                <button className="btn btn-primary" onClick={openAddModal}>
                  ➕ 添加会员
                </button>
              </div>
            </div>

            <div className="members-table-container">
              <table className="members-table">
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>手机号</th>
                    <th>等级</th>
                    <th>余额</th>
                    <th>注册时间</th>
                    <th>最后消费</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        <div className="empty-icon">👤</div>
                        <p>暂无会员数据</p>
                        <p className="empty-hint">点击右上角添加会员</p>
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <tr key={member.id}>
                        <td className="name-cell">{member.name}</td>
                        <td className="phone-cell">{member.phone}</td>
                        <td>
                          <span className={`level-badge level-${member.level}`}>{member.level}</span>
                        </td>
                        <td className="balance">¥{member.balance.toFixed(2)}</td>
                        <td>{new Date(member.created_at).toLocaleDateString()}</td>
                        <td>{member.last_visit ? new Date(member.last_visit).toLocaleDateString() : "-"}</td>
                        <td className="actions-cell">
                          <button className="btn btn-small btn-secondary" onClick={() => openEditModal(member)}>
                            编辑
                          </button>
                          <button className="btn btn-small btn-danger" onClick={() => handleDelete(member.id)}>
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 消费记录页面 */}
        {activeTab === "records" && (
          <>
            <div className="section-header">
              <div>
                <h2>📋 消费记录</h2>
                <p className="section-desc">共 {records.length} 条记录</p>
              </div>
              <button className="btn btn-primary" onClick={openAddRecordModal}>
                ➕ 添加记录
              </button>
            </div>

            <div className="records-table-container">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>会员</th>
                    <th>服务项目</th>
                    <th>金额</th>
                    <th>支付方式</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        <div className="empty-icon">📝</div>
                        <p>暂无消费记录</p>
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id}>
                        <td>{new Date(record.created_at).toLocaleString()}</td>
                        <td>{record.member_name}</td>
                        <td>{record.service_name}</td>
                        <td className="amount">¥{record.amount.toFixed(2)}</td>
                        <td>{record.payment_method}</td>
                        <td>{record.note || "-"}</td>
                        <td className="actions-cell">
                          <button className="btn btn-small btn-danger" onClick={() => handleDeleteRecord(record.id)}>
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 服务管理页面 */}
        {activeTab === "services" && (
          <>
            <div className="section-header">
              <div>
                <h2>✂️ 服务管理</h2>
                <p className="section-desc">共 {services.length} 项服务</p>
              </div>
              <button className="btn btn-primary" onClick={openAddServiceModal}>
                ➕ 添加服务
              </button>
            </div>

            <div className="members-table-container">
              <table className="members-table">
                <thead>
                  <tr>
                    <th>服务名称</th>
                    <th>价格</th>
                    <th>分类</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td className="name-cell">{service.name}</td>
                      <td className="balance">¥{service.price.toFixed(2)}</td>
                      <td>{service.category}</td>
                      <td className="actions-cell">
                        <button className="btn btn-small btn-secondary" onClick={() => openEditServiceModal(service)}>
                          编辑
                        </button>
                        <button className="btn btn-small btn-danger" onClick={() => handleDeleteService(service.id)}>
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 数据统计页面 */}
        {activeTab === "stats" && (
          <>
            <div className="section-header">
              <h2>📊 数据统计</h2>
            </div>

            <div className="stats-cards">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-value">{stats.totalMembers}</div>
                <div className="stat-label">会员总数</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-value">¥{stats.totalBalance.toFixed(0)}</div>
                <div className="stat-label">会员总余额</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-value">{stats.todayRecords}</div>
                <div className="stat-label">今日消费</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-value">{stats.totalRecords}</div>
                <div className="stat-label">总消费记录</div>
              </div>
            </div>

            <div className="stats-detail">
              <h3>会员等级分布</h3>
              <div className="level-stats">
                {Object.entries(levelStats).map(([level, count]) => (
                  <div key={level} className="level-stat-item">
                    <span className={`level-badge level-${level}`}>{level}</span>
                    <span className="level-count">{count}人</span>
                    <div className="level-bar">
                      <div
                        className="level-bar-fill"
                        style={{ width: `${members.length > 0 ? (count / members.length) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <span className="level-percentage">
                      {members.length > 0 ? Math.round((count / members.length) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 设置页面 */}
        {activeTab === "settings" && (
          <>
            <div className="section-header">
              <h2>⚙️ 设置</h2>
            </div>

            <div className="settings-content">
              <div className="setting-group">
                <h3>数据备份与恢复</h3>
                <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                  <button className="btn btn-primary" onClick={exportData}>
                    📤 导出数据
                  </button>
                  <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                    📥 导入数据
                    <input
                      type="file"
                      accept=".json"
                      style={{ display: "none" }}
                      onChange={importDataFromFile}
                    />
                  </label>
                </div>
                <p className="form-hint" style={{ marginTop: "0.5rem" }}>
                  导出为 JSON 格式，可用于备份或在其他设备恢复
                </p>
              </div>

              <div className="setting-group" style={{ marginTop: "2rem" }}>
                <h3>⚠️ 危险操作</h3>
                <button className="btn btn-danger" onClick={handleClearAll} style={{ marginTop: "1rem" }}>
                  🗑️ 清空所有数据
                </button>
                <p className="form-hint" style={{ marginTop: "0.5rem", color: "#ef4444" }}>
                  此操作不可恢复，请谨慎使用！
                </p>
              </div>
            </div>
          </>
        )}
      </main>

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

      {/* 会员弹窗 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditing ? "编辑会员" : "添加会员"}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && <div className="form-error">{formError}</div>}
                <div className="form-group">
                  <label>姓名 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="请输入会员姓名"
                  />
                </div>
                <div className="form-group">
                  <label>手机号 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="请输入手机号"
                    disabled={isEditing}
                  />
                </div>
                <div className="form-group">
                  <label>会员等级</label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  >
                    <option value="普通">普通</option>
                    <option value="银卡">银卡 (9折)</option>
                    <option value="金卡">金卡 (8折)</option>
                    <option value="钻石">钻石 (7折)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>余额</label>
                  <div className="balance-input">
                    <span className="balance-prefix">¥</span>
                    <input
                      type="number"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 消费记录弹窗 */}
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
                    value={recordForm.member_id}
                    onChange={(e) => {
                      const id = parseInt(e.target.value);
                      setRecordForm({ ...recordForm, member_id: id });
                      setSelectedMemberId(id);
                    }}
                  >
                    <option value={0}>请选择会员</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.phone})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>服务项目 <span className="required">*</span></label>
                  <select
                    value={recordForm.service_id}
                    onChange={(e) => {
                      const serviceId = parseInt(e.target.value);
                      const service = services.find((s) => s.id === serviceId);
                      setRecordForm({
                        ...recordForm,
                        service_id: serviceId,
                        amount: service?.price || 0,
                      });
                    }}
                  >
                    <option value={0}>请选择服务</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (¥{s.price})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>金额 <span className="required">*</span></label>
                  <div className="balance-input">
                    <span className="balance-prefix">¥</span>
                    <input
                      type="number"
                      value={recordForm.amount}
                      onChange={(e) => setRecordForm({ ...recordForm, amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>支付方式</label>
                  <select
                    value={recordForm.payment_method}
                    onChange={(e) => setRecordForm({ ...recordForm, payment_method: e.target.value })}
                  >
                    <option value="现金">现金</option>
                    <option value="微信">微信</option>
                    <option value="支付宝">支付宝</option>
                    <option value="刷卡">刷卡</option>
                    <option value="余额">余额</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>备注</label>
                  <input
                    type="text"
                    value={recordForm.note}
                    onChange={(e) => setRecordForm({ ...recordForm, note: e.target.value })}
                    placeholder="可选"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRecordModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingRecord}>
                  {submittingRecord ? "添加中..." : "添加"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 服务弹窗 */}
      {showServiceModal && (
        <div className="modal-overlay" onClick={() => setShowServiceModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditingService ? "编辑服务" : "添加服务"}</h3>
              <button className="modal-close" onClick={() => setShowServiceModal(false)}>✕</button>
            </div>
            <form onSubmit={handleServiceSubmit}>
              <div className="modal-body">
                {serviceError && <div className="form-error">{serviceError}</div>}
                <div className="form-group">
                  <label>服务名称 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    placeholder="如：洗剪吹"
                  />
                </div>
                <div className="form-group">
                  <label>价格 <span className="required">*</span></label>
                  <div className="balance-input">
                    <span className="balance-prefix">¥</span>
                    <input
                      type="number"
                      value={serviceForm.price}
                      onChange={(e) => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>分类</label>
                  <input
                    type="text"
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                    placeholder="如：基础、烫染、护理"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowServiceModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingService}>
                  {submittingService ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel导入弹窗 */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📥 Excel导入会员</h3>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {importStep === "upload" && (
                <div className="import-step">
                  <p className="import-hint">请上传包含会员信息的 Excel 文件（.xlsx 或 .xls）</p>
                  <div className="import-upload-area">
                    <label className="import-upload-label">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        style={{ display: "none" }}
                        onChange={handleFileUpload}
                      />
                      <div className="upload-icon">📁</div>
                      <p>点击选择文件或拖拽到此处</p>
                      <p className="upload-hint">支持 .xlsx, .xls 格式</p>
                    </label>
                  </div>
                </div>
              )}

              {importStep === "mapping" && (
                <div className="import-step">
                  <p className="import-hint">请将 Excel 列与系统字段进行匹配</p>
                  <div className="mapping-table">
                    <div className="mapping-row">
                      <span className="mapping-label">姓名 *</span>
                      <select
                        value={importMapping.name}
                        onChange={(e) => setImportMapping({ ...importMapping, name: e.target.value })}
                      >
                        <option value="">请选择列</option>
                        {importData.length > 0 &&
                          Object.keys(importData[0]).map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="mapping-row">
                      <span className="mapping-label">手机号 *</span>
                      <select
                        value={importMapping.phone}
                        onChange={(e) => setImportMapping({ ...importMapping, phone: e.target.value })}
                      >
                        <option value="">请选择列</option>
                        {importData.length > 0 &&
                          Object.keys(importData[0]).map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="mapping-row">
                      <span className="mapping-label">等级</span>
                      <select
                        value={importMapping.level}
                        onChange={(e) => setImportMapping({ ...importMapping, level: e.target.value })}
                      >
                        <option value="">请选择列（可选）</option>
                        {importData.length > 0 &&
                          Object.keys(importData[0]).map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="mapping-row">
                      <span className="mapping-label">余额</span>
                      <select
                        value={importMapping.balance}
                        onChange={(e) => setImportMapping({ ...importMapping, balance: e.target.value })}
                      >
                        <option value="">请选择列（可选）</option>
                        {importData.length > 0 &&
                          Object.keys(importData[0]).map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={previewImport}
                    disabled={!importMapping.name || !importMapping.phone}
                  >
                    下一步：预览数据
                  </button>
                </div>
              )}

              {importStep === "preview" && (
                <div className="import-step">
                  <p className="import-hint">共 {importPreview.length} 条有效数据，将导入以下会员：</p>
                  <div className="import-preview-table">
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
                        {importPreview.slice(0, 10).map((member, idx) => (
                          <tr key={idx}>
                            <td>{member.name}</td>
                            <td>{member.phone}</td>
                            <td>{member.level || "普通"}</td>
                            <td>¥{(member.balance || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importPreview.length > 10 && (
                      <p style={{ textAlign: "center", color: "#666", marginTop: "0.5rem" }}>
                        还有 {importPreview.length - 10} 条数据...
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                    <button className="btn btn-secondary" onClick={() => setImportStep("mapping")}>
                      返回修改
                    </button>
                    <button className="btn btn-primary" onClick={executeImport} disabled={importing}>
                      {importing ? "导入中..." : `确认导入 (${importPreview.length}人)`}
                    </button>
                  </div>
                </div>
              )}

              {importStep === "result" && importResult && (
                <div className="import-step">
                  <div className="import-result">
                    <div className="result-icon">✅</div>
                    <h4>导入完成</h4>
                    <p>成功导入: {importResult.success} 人</p>
                    {importResult.skipped > 0 && (
                      <p className="import-skipped">跳过重复: {importResult.skipped} 人</p>
                    )}
                    {importResult.errors.length > 0 && (
                      <div style={{ marginTop: "1rem", textAlign: "left" }}>
                        <p style={{ color: "#ef4444" }}>错误 ({importResult.errors.length}条):</p>
                        <ul style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.5rem" }}>
                          {importResult.errors.slice(0, 5).map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li>还有 {importResult.errors.length - 5} 条错误...</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportStep("upload");
                      setImportFile(null);
                      setImportData([]);
                      setImportResult(null);
                    }}
                    style={{ marginTop: "1rem" }}
                  >
                    完成
                  </button>
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

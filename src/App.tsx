import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
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

interface MemberFormData {
  name: string;
  phone: string;
  level: string;
  balance: number;
}

function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("members");
  
  // 添加会员弹窗状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<MemberFormData>({
    name: "",
    phone: "",
    level: "普通",
    balance: 0,
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      const data = await invoke<Member[]>("get_members");
      setMembers(data);
    } catch (error) {
      console.error("Failed to load members:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "balance" ? parseFloat(value) || 0 : value,
    }));
    setFormError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // 表单验证
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
      await invoke("add_member", {
        member: {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          level: formData.level,
          balance: formData.balance,
        },
      });
      
      // 重置表单并关闭弹窗
      setFormData({ name: "", phone: "", level: "普通", balance: 0 });
      setShowAddModal(false);
      
      // 刷新会员列表
      await loadMembers();
    } catch (error: any) {
      if (error.includes("UNIQUE constraint failed")) {
        setFormError("该手机号已存在");
      } else {
        setFormError("添加失败: " + error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`确定要删除会员 "${name}" 吗？此操作不可恢复。`)) {
      return;
    }
    
    try {
      await invoke("delete_member", { id });
      await loadMembers();
    } catch (error) {
      console.error("Failed to delete member:", error);
      alert("删除失败");
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>💈 理发管家</h1>
        <nav className="nav-tabs">
          <button
            className={activeTab === "members" ? "active" : ""}
            onClick={() => setActiveTab("members")}
          >
            会员管理
          </button>
          <button
            className={activeTab === "records" ? "active" : ""}
            onClick={() => setActiveTab("records")}
          >
            消费记录
          </button>
          <button
            className={activeTab === "stats" ? "active" : ""}
            onClick={() => setActiveTab("stats")}
          >
            数据统计
          </button>
          <button
            className={activeTab === "settings" ? "active" : ""}
            onClick={() => setActiveTab("settings")}
          >
            系统设置
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === "members" && (
          <div className="members-section">
            <div className="section-header">
              <h2>会员列表</h2>
              <div className="actions">
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowAddModal(true)}
                >
                  + 添加会员
                </button>
                <button className="btn btn-secondary">📥 导入Excel</button>
              </div>
            </div>

            {loading ? (
              <div className="loading">加载中...</div>
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
                          暂无会员数据，点击"添加会员"或"导入Excel"开始录入
                        </td>
                      </tr>
                    ) : (
                      members.map((member) => (
                        <tr key={member.id}>
                          <td>{member.name}</td>
                          <td>{member.phone}</td>
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
                          <td>
                            <button className="btn btn-small">编辑</button>
                            <button 
                              className="btn btn-small btn-danger"
                              onClick={() => handleDelete(member.id, member.name)}
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
            <h2>消费记录</h2>
            <p className="placeholder">消费记录功能开发中...</p>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="stats-section">
            <h2>数据统计</h2>
            <div className="stats-cards">
              <div className="stat-card">
                <div className="stat-value">{members.length}</div>
                <div className="stat-label">总会员数</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  ¥{members.reduce((sum, m) => sum + m.balance, 0).toFixed(2)}
                </div>
                <div className="stat-label">会员总余额</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="settings-section">
            <h2>系统设置</h2>
            <p className="placeholder">系统设置功能开发中...</p>
          </div>
        )}
      </main>

      {/* 添加会员弹窗 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加新会员</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                ×
              </button>
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
                  />
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
                  <label>初始余额</label>
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
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

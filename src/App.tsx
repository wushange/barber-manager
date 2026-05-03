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

function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("members");

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
                <button className="btn btn-primary">+ 添加会员</button>
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
                            <button className="btn btn-small btn-danger">删除</button>
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
    </div>
  );
}

export default App;

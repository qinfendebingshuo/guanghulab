/* ============================================
 HoloLake · M06 工单管理界面 · 逻辑层
 环节3：响应式 + 数据导出（JSON/CSV）
 DEV-010 桔子
 ============================================ */
// === 状态流转规则 ===
const STATUS_FLOW = {
 'pending': { next: 'active', label: '待处理' },
 'active': { next: 'done', label: '进行中' },
 'done': { next: 'pending', label: '已完成' }
};
// === 初始化 · 从 localStorage 读取工单 ===
let tickets = JSON.parse(localStorage.getItem('holotake_tic
kets') || '[]');
// === 保存到 localStorage ===
function saveTickets() {
 localStorage.setItem('holotake_tickets', JSON.stringify(t
ickets));
}
// === 生成工单编号 ===
function generateId() {
 const now = new Date();
 const dateStr = [
 now.getFullYear(),
📡 BC-M06-001 · DEV-010桔子 · 工单管理界面·环节3·响应式布局+数据导出 18
 String(now.getMonth() + 1).padStart(2, '0'),
 String(now.getDate()).padStart(2, '0')
 ].join('');
 const rand = String(Math.floor(Math.random() * 1000)).pad
Start(3, '0');
 return 'TK-' + dateStr + '-' + rand;
}
// === 渲染统计卡片 ===
function renderStats() {
 const total = tickets.length;
 const pending = tickets.filter(t => t.status === 'pendin
g').length;
 const active = tickets.filter(t => t.status === 'activ
e').length;
 const done = tickets.filter(t => t.status === 'done').len
gth;
 document.getElementById('statTotal').textContent = total;
 document.getElementById('statPending').textContent = pend
ing;
 document.getElementById('statActive').textContent = activ
e;
 document.getElementById('statDone').textContent = done;
}
// === 获取筛选和排序后的工单列表 ===
function getFilteredTickets() {
 const filterStatus = document.getElementById('filterStatu
s').value;
 const sortBy = document.getElementById('sortBy').value;
 let list = [...tickets];
 // 筛选
 if (filterStatus !== 'all') {
 list = list.filter(t => t.status === filterStatus);
 }
📡 BC-M06-001 · DEV-010桔子 · 工单管理界面·环节3·响应式布局+数据导出 19
 // 排序
 if (sortBy === 'newest') {
 list.sort((a, b) => new Date(b.createdAt) - new Date(a.
createdAt));
 } else if (sortBy === 'oldest') {
 list.sort((a, b) => new Date(a.createdAt) - new Date(b.
createdAt));
 } else if (sortBy === 'status') {
 const order = { 'pending': 0, 'active': 1, 'done': 2 };
 list.sort((a, b) => order[a.status] - order[b.status]);
 }
 return list;
}
// === 渲染工单列表 ===
function renderTickets() {
 const list = getFilteredTickets();
 const container = document.getElementById('ticketList');
 if (list.length === 0) {
 container.innerHTML = '<div class="empty-state"><div cl
ass="empty-icon">📋</div><div class="empty-text">暂无工单，点
击上方按钮新建</div></div>';
 return;
 }
 container.innerHTML = list.map(ticket => {
 const statusInfo = STATUS_FLOW[ticket.status];
 return '<div class="ticket-item">' +
 '<span class="ticket-id">' + ticket.id + '</span>' +
 '<div class="ticket-info">' +
 '<div class="ticket-title">' + escapeHtml(ticket.ti
tle) + '</div>' +
 '<div class="ticket-meta">负责人：' + escapeHtml(tic
ket.assignee) + ' · ' + formatDate(ticket.createdAt) + '</d
iv>' +
📡 BC-M06-001 · DEV-010桔子 · 工单管理界面·环节3·响应式布局+数据导出 20
 '</div>' +
 '<div class="ticket-actions">' +
 '<span class="status-badge ' + ticket.status + '" o
nclick="toggleStatus(\'' + ticket.id + '\')">' + statusInf
o.label + '</span>' +
 '<button class="btn-delete" onclick="deleteTicket
(\'' + ticket.id + '\')" title="删除">🗑</button>' +
 '</div>' +
 '</div>';
 }).join('');
}
// === HTML转义（防XSS） ===
function escapeHtml(str) {
 const div = document.createElement('div');
 div.textContent = str;
 return div.innerHTML;
}
// === 格式化日期 ===
function formatDate(dateStr) {
 const d = new Date(dateStr);
 return d.getFullYear() + '-' +
 String(d.getMonth() + 1).padStart(2, '0') + '-' +
 String(d.getDate()).padStart(2, '0') + ' ' +
 String(d.getHours()).padStart(2, '0') + ':' +
 String(d.getMinutes()).padStart(2, '0');
}
// === 切换工单状态 ===
function toggleStatus(id) {
 const ticket = tickets.find(t => t.id === id);
 if (!ticket) return;
 ticket.status = STATUS_FLOW[ticket.status].next;
 saveTickets();
 renderAll();
}
📡 BC-M06-001 · DEV-010桔子 · 工单管理界面·环节3·响应式布局+数据导出 21
// === 删除工单 ===
function deleteTicket(id) {
 if (!confirm('确认删除这条工单？')) return;
 tickets = tickets.filter(t => t.id !== id);
 saveTickets();
 renderAll();
}
// === 新建工单弹窗 ===
function openModal() {
 document.getElementById('modalOverlay').classList.add('sh
ow');
 document.getElementById('inputTitle').value = '';
 document.getElementById('inputAssignee').value = '';
 document.getElementById('inputDetail').value = '';
 document.getElementById('inputTitle').focus();
}
function closeModal() {
 document.getElementById('modalOverlay').classList.remove
('show');
}
// === 提交新建工单 ===
function submitTicket() {
 const title = document.getElementById('inputTitle').valu
e.trim();
 const assignee = document.getElementById('inputAssigne
e').value.trim();
 const detail = document.getElementById('inputDetail').val
ue.trim();
 if (!title) {
 alert('请填写工单标题');
 return;
 }
 if (!assignee) {
 alert('请填写负责人');
📡 BC-M06-001 · DEV-010桔子 · 工单管理界面·环节3·响应式布局+数据导出 22
 return;
 }
 const newTicket = {
 id: generateId(),
 title: title,
 assignee: assignee,
 detail: detail,
 status: 'pending',
 createdAt: new Date().toISOString()
 };
 tickets.unshift(newTicket);
 saveTickets();
 closeModal();
 renderAll();
}
// === 重置全部工单 ===
function resetTickets() {
 if (!confirm('确认清空所有工单数据？此操作不可恢复！')) return;
 tickets = [];
 saveTickets();
 renderAll();
}
// ============================================
// 环节3新增：导出功能
// ============================================
// === 导出下拉菜单控制 ===
function toggleExportMenu() {
 const dropdown = document.getElementById('exportDropdow
n');
 const clickAway = document.getElementById('clickAway');
 const isOpen = dropdown.classList.contains('show');
 if (isOpen) {
📡 BC-M06-001 · DEV-010桔子 · 工单管理界面·环节3·响应式布局+数据导出 23
 closeExportMenu();
 } else {
 dropdown.classList.add('show');
 clickAway.classList.add('show');
 }
}
function closeExportMenu() {
 document.getElementById('exportDropdown').classList.remov
e('show');
 document.getElementById('clickAway').classList.remove('sh
ow');
}
// === 导出为 JSON 文件 ===
function exportJSON() {
 closeExportMenu();
 if (tickets.length === 0) {
 alert('当前没有工单数据可导出');
 return;
 }
 const data = JSON.stringify(tickets, null, 2);
 const blob = new Blob([data], { type: 'application/json;c
harset=utf-8' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'HoloLake-Tickets-' + getDateStamp() + '.jso
n';
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
}
📡 BC-M06-001 · DEV-010桔子 · 工单管理界面·环节3·响应式布局+数据导出 24
// === 导出为 CSV 文件 ===
function exportCSV() {
 closeExportMenu();
 if (tickets.length === 0) {
 alert('当前没有工单数据可导出');
 return;
 }
 // CSV表头
 const header = '编号,标题,负责人,状态,详情,创建时间';
 // CSV内容行
 const rows = tickets.map(t => {
 const statusLabel = STATUS_FLOW[t.status] ? STATUS_FLOW
[t.status].label : t.status;
 return [
 t.id,
 csvEscape(t.title),
 csvEscape(t.assignee),
 statusLabel,
 csvEscape(t.detail || ''),
 formatDate(t.createdAt)
 ].join(',');
 });
 const csv = '\uFEFF' + header + '\n' + rows.join('\n');
 const blob = new Blob([csv], { type: 'text/csv;charset=ut
f-8' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'HoloLake-Tickets-' + getDateStamp() + '.cs
v';
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
📡 BC-M06-001 · DEV-010桔子 · 工单管理界面·环节3·响应式布局+数据导出 25
 URL.revokeObjectURL(url);
}
// === CSV字段转义（处理逗号和引号） ===
function csvEscape(str) {
 if (!str) return '';
 if (str.includes(',') || str.includes('"') || str.include
s('\n')) {
 return '"' + str.replace(/"/g, '""') + '"';
 }
 return str;
}
// === 生成日期戳（用于文件名） ===
function getDateStamp() {
 const now = new Date();
 return now.getFullYear() +
 String(now.getMonth() + 1).padStart(2, '0') +
 String(now.getDate()).padStart(2, '0') + '-' +
 String(now.getHours()).padStart(2, '0') +
 String(now.getMinutes()).padStart(2, '0');
}
// === 统一渲染 ===
function renderAll() {
 renderStats();
 renderTickets();
}
// === 筛选/排序变化时重新渲染 ===
document.getElementById('filterStatus').addEventListener('c
hange', renderTickets);
document.getElementById('sortBy').addEventListener('chang
e', renderTickets);
// === 弹窗点击遮罩关闭 ===
document.getElementById('modalOverlay').addEventListener('c
lick', function(e) {
📡 BC-M06-001 · DEV-010桔子 · 工单管理界面·环节3·响应式布局+数据导出 26
 if (e.target === this) closeModal();
});
// === 页面加载完成 · 首次渲染 ===
renderAll();

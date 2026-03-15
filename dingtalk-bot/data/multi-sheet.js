// data/multi-sheet.js
// Phase 2 - 多维表格数据

const developers = [
  {
    dev_id: 'DEV-004',
    name: '之之',
    status: '进行中',
    current_module: 'M-DINGTALK Phase 3',
    last_broadcast_time: new Date().toISOString()
  }
];

function getAll() {
  return { developers };
}

function getByDevId(id) {
  return developers.find(d => d.dev_id === id);
}

module.exports = { getAll, getByDevId };

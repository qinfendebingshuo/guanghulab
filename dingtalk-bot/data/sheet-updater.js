// data/sheet-updater.js
// Phase 2 - 表格更新器

function updateFromSyslog(syslogData) {
  console.log('[SheetUpdater] 更新表格:', syslogData);
  return { status: 'updated' };
}

module.exports = { updateFromSyslog };

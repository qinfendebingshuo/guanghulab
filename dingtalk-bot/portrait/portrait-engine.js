const fs = require('fs');
const path = require('path');
const analyzer = require('./portrait-analyzer');

const DB_PATH = path.join(__dirname, '../data/portrait-db.json');
const HISTORY_PATH = path.join(__dirname, '../data/portrait-history.json');

if (!fs.existsSync(path.join(__dirname, '../data'))) {
    fs.mkdirSync(path.join(__dirname, '../data'));
}

function initDB() {
    if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({}));
    if (!fs.existsSync(HISTORY_PATH)) fs.writeFileSync(HISTORY_PATH, JSON.stringify([]));
}

function updatePortrait(syslogData) {
    initDB();
    const devId = syslogData.dev_id || 'DEV-004';
    const snapshot = analyzer.generateSnapshot(syslogData);
    
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    const history = JSON.parse(fs.readFileSync(HISTORY_PATH));
    
    if (!db[devId]) {
        db[devId] = {
            dev_id: devId,
            dev_name: syslogData.dev_name || '之之',
            first_seen: snapshot.timestamp,
            total_sessions: 0,
            total_code_lines: 0,
            max_streak: 0,
            current_streak: 0,
            recent_snapshots: []
        };
    }
    
    const dev = db[devId];
    dev.total_sessions++;
    dev.total_code_lines += syslogData.code_lines || 0;
    
    if (syslogData.status === 'completed') {
        dev.current_streak++;
        if (dev.current_streak > dev.max_streak) dev.max_streak = dev.current_streak;
    } else {
        dev.current_streak = 0;
    }
    
    dev.recent_snapshots.unshift(snapshot);
    if (dev.recent_snapshots.length > 10) dev.recent_snapshots.pop();
    
    history.unshift({
        timestamp: snapshot.timestamp,
        dev_id: devId,
        session_id: snapshot.session_id,
        snapshot: snapshot
    });
    if (history.length > 500) history.pop();
    
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
    
    return snapshot;
}

function getPortrait(devId) {
    initDB();
    return JSON.parse(fs.readFileSync(DB_PATH))[devId] || null;
}

function getAllPortraits() {
    initDB();
    return JSON.parse(fs.readFileSync(DB_PATH));
}

function getHistory(limit = 50) {
    initDB();
    return JSON.parse(fs.readFileSync(HISTORY_PATH)).slice(0, limit);
}

module.exports = { updatePortrait, getPortrait, getAllPortraits, getHistory };

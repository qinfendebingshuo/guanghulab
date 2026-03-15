const MOCK_DEVELOPERS = [
    { id: 'DEV-001', name: '玄泓', streak: 8, el: 6, pca: { exe: 75, tec: 68, sys: 82, col: 79, ini: 85 }, totalScore: 78, status: 'doing', module: 'M-CORE', lastActive: '2026-03-11T10:30:00Z' },
    { id: 'DEV-002', name: '苍钺', streak: 5, el: 5, pca: { exe: 82, tec: 71, sys: 65, col: 90, ini: 72 }, totalScore: 76, status: 'pending', module: 'M-UI', lastActive: '2026-03-11T09:15:00Z' },
    { id: 'DEV-003', name: '桔子', streak: 13, el: 8, pca: { exe: 88, tec: 85, sys: 92, col: 78, ini: 90 }, totalScore: 87, status: 'doing', module: 'M-ORCHESTRATOR', lastActive: '2026-03-11T11:20:00Z' },
    { id: 'DEV-004', name: '之之', streak: 12, el: 8, pca: { exe: 70, tec: 32, sys: 80, col: 80, ini: 83 }, totalScore: 66, status: 'doing', module: 'M-DEVBOARD', lastActive: '2026-03-11T12:05:00Z' },
    { id: 'DEV-005', name: '琉光', streak: 7, el: 6, pca: { exe: 79, tec: 74, sys: 71, col: 88, ini: 77 }, totalScore: 78, status: 'done', module: 'M-TEST', lastActive: '2026-03-10T16:40:00Z' },
    { id: 'DEV-006', name: '墨羽', streak: 4, el: 4, pca: { exe: 65, tec: 60, sys: 55, col: 92, ini: 68 }, totalScore: 68, status: 'doing', module: 'M-DOC', lastActive: '2026-03-11T08:50:00Z' },
    { id: 'DEV-007', name: '霜砚', streak: 10, el: 7, pca: { exe: 84, tec: 79, sys: 81, col: 75, ini: 82 }, totalScore: 80, status: 'blocked', module: 'M-API', lastActive: '2026-03-11T07:30:00Z' },
    { id: 'DEV-008', name: '岚茵', streak: 6, el: 5, pca: { exe: 73, tec: 70, sys: 68, col: 85, ini: 74 }, totalScore: 74, status: 'pending', module: 'M-DESIGN', lastActive: '2026-03-10T14:20:00Z' }
];

function getTopStreak(developers) {
    if (!developers || developers.length === 0) return { name: '无', count: 0 };
    let top = developers[0];
    for (let i = 1; i < developers.length; i++) {
        if (developers[i].streak > top.streak) {
            top = developers[i];
        }
    }
    return { name: top.name, count: top.streak };
}

async function getDevStatus() {
    return MOCK_DEVELOPERS;
}

async function getPCA(devId) {
    const dev = MOCK_DEVELOPERS.find(d => d.id === devId);
    if (!dev) return null;
    return {
        exe: dev.pca.exe,
        tec: dev.pca.tec,
        sys: dev.pca.sys,
        col: dev.pca.col,
        ini: dev.pca.ini,
        total: dev.totalScore,
        level: getPCAColor(dev.totalScore).level
    };
}

async function getAllStats() {
    const activeDevs = MOCK_DEVELOPERS.filter(d => d.status === 'doing').length;
    const topStreak = getTopStreak(MOCK_DEVELOPERS);
    return {
        totalDevs: 8,
        activeDevs: activeDevs,
        totalCodeLines: 85600,
        totalModules: 24,
        modulesCompleted: 8,
        modulesInProgress: 12,
        modulesPending: 4,
        topStreak: topStreak
    };
}

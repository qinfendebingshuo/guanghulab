// GitHub桥接模块·github-bridge.js·v1.0
// HoloLake·M-DINGTALK Phase8
// DEV-004 之之×秋秋
//
// 功能：钉钉命令→GitHubAPI→结果回传钉钉
// 支持：查PR·查Issue·查仓库状态·触发部署
//

var axios = require('axios');

var GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
var GITHUB_OWNER = process.env.GITHUB_OWNER || 'qinfendebingshuo';
var GITHUB_REPO = process.env.GITHUB_REPO || 'guanghulab';
var GITHUB_API = 'https://api.github.com';

// ===== GitHub API 请求封装 =====
async function githubRequest(endpoint, method, data) {
    method = method || 'GET';
    var url = GITHUB_API + endpoint;
    try {
        var config = {
            method: method,
            url: url,
            headers: {
                'Authorization': GITHUB_TOKEN ? ('token ' + GITHUB_TOKEN) : undefined,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'HoloLake-DingTalk-Bot'
            },
            timeout: 15000
        };
        if (data) config.data = data;
        var res = await axios(config);
        return { ok: true, data: res.data, status: res.status };
    } catch (err) {
        var status = err.response ? err.response.status : 0;
        var msg = err.response ? (err.response.data.message || err.message) : err.message;
        console.error('[GitHub] API错误: ' + status + ' ' + msg);
        return { ok: false, error: msg, status: status };
    }
}

// ====== /github status · 仓库状态 =====
async function getRepoStatus() {
    var res = await githubRequest('/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO);
    if (!res.ok) return '❌ 获取仓库状态失败: ' + res.error;
    var repo = res.data;
    
    // 获取最近提交
    var commitsRes = await githubRequest('/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/commits?per_page=3');
    var commitsText = '';
    if (commitsRes.ok && commitsRes.data.length > 0) {
        commitsText = '\n\n**最近提交:**\n';
        commitsRes.data.forEach(function(c, i) {
            var date = new Date(c.commit.author.date).toLocaleString('zh-CN');
            var msg = (c.commit.message || '').split('\n')[0].substring(0, 60);
            commitsText += (i + 1) + '. `' + msg + '` · ' + date + '\n';
        });
    }
    
    return '### 📊 仓库状态\n\n'
        + '- **仓库**: ' + repo.full_name + '\n'
        + '- **默认分支**: ' + repo.default_branch + '\n'
        + '- **Star**: ' + repo.stargazers_count + ' · **Fork**: ' + repo.forks_count + '\n'
        + '- **最后更新**: ' + new Date(repo.updated_at).toLocaleString('zh-CN') + '\n'
        + '- **大小**: ' + Math.round(repo.size / 1024) + ' MB'
        + commitsText;
}

// ====== /github pr · 查看PR ======
async function listPRs(state) {
    state = state || 'open';
    var res = await githubRequest('/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/pulls?state=' + state + '&per_page=10');
    if (!res.ok) return '❌ 获取PR列表失败: ' + res.error;
    var prs = res.data;
    if (prs.length === 0) return '### 📋 Pull Requests\n\n当前没有' + (state === 'open' ? '打开的' : '') + 'PR。';
    
    var text = '### 📋 Pull Requests（' + state + '）\n\n';
    prs.forEach(function(pr) {
        var date = new Date(pr.created_at).toLocaleString('zh-CN');
        text += '- **#' + pr.number + '** ' + pr.title + '\n';
        text += '  👤 ' + pr.user.login + ' · 📅 ' + date + '\n';
    });
    return text;
}

// ====== /github issue · 查看Issue ======
async function listIssues(state) {
    state = state || 'open';
    var res = await githubRequest('/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/issues?state=' + state + '&per_page=10');
    if (!res.ok) return '❌ 获取Issue列表失败: ' + res.error;
    var issues = res.data.filter(function(i) { return !i.pull_request; }); // 排除PR
    if (issues.length === 0) return '### 📋 Issues\n\n当前没有' + (state === 'open' ? '打开的' : '') + 'Issue。';
    
    var text = '### 📋 Issues（' + state + '）\n\n';
    issues.forEach(function(issue) {
        var labels = issue.labels.map(function(l) { return l.name; }).join(', ');
        text += '- **#' + issue.number + '** ' + issue.title;
        if (labels) text += ' `' + labels + '`';
        text += '\n';
    });
    return text;
}

// ====== /github actions · 查看最近的Actions运行 ======
async function listActions() {
    var res = await githubRequest('/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/actions/runs?per_page=5');
    if (!res.ok) return '❌ 获取Actions状态失败: ' + res.error;
    var runs = res.data.workflow_runs || [];
    if (runs.length === 0) return '### GitHub Actions\n\n暂无运行记录。';
    
    var text = '### GitHub Actions（最近5次）\n\n';
    runs.forEach(function(run) {
        var status = run.conclusion || run.status;
        var icon = status === 'success' ? '✅' : status === 'failure' ? '❌' : '⏳';
        var date = new Date(run.created_at).toLocaleString('zh-CN');
        text += '- ' + icon + ' **' + run.name + '** ' + status + ' · ' + date + '\n';
    });
    return text;
}

// ====== /github deploy · 触发部署 (dispatch事件) =====
async function triggerDeploy(environment) {
    environment = environment || 'production';
    var res = await githubRequest(
        '/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/dispatches',
        'POST',
        {
            event_type: 'deploy',
            client_payload: {
                environment: environment,
                triggered_by: 'dingtalk-bot',
                timestamp: new Date().toISOString()
            }
        }
    );
    
    if (res.status === 204 || res.ok) {
        return '### 🚀 部署触发成功\n\n'
            + '- **环境**: ' + environment + '\n'
            + '- **触发时间**: ' + new Date().toLocaleString('zh-CN') + '\n'
            + '- **来源**: 钉钉机器人\n\n'
            + '> 请到 GitHub Actions 页面查看部署进度。';
    }
    return '❌ 触发部署失败: ' + (res.error || '未知错误') + '\n> 请确认仓库已配置 repository_dispatch 工作流。';
}

// ====== 命令路由 =====
async function handleGitHubCommand(args) {
    var subCommand = (args[0] || 'help').toLowerCase();
    
    switch (subCommand) {
        case 'status':
        case '状态':
            return await getRepoStatus();
            
        case 'pr':
        case 'prs':
            return await listPRs(args[1] || 'open');
            
        case 'issue':
        case 'issues':
            return await listIssues(args[1] || 'open');
            
        case 'actions':
        case 'ci':
            return await listActions();
            
        case 'deploy':
        case '部署':
            return await triggerDeploy(args[1] || 'production');
            
        case 'help':
        case '帮助':
        default:
            return '### GitHub 桥接命令\n\n'
                + '| 命令 | 说明 |\n'
                + '|------|------|\n'
                + '| `/github status` | 查看仓库状态+最近提交 |\n'
                + '| `/github pr` | 查看打开的PR |\n'
                + '| `/github pr closed` | 查看已关闭的PR |\n'
                + '| `/github issue` | 查看打开的Issue |\n'
                + '| `/github actions` | 查看最近CI/CD运行 |\n'
                + '| `/github deploy` | 触发生产部署 |\n'
                + '| `/github help` | 显示本帮助 |\n\n'
                + '> HoloLake · M-DINGTALK Phase 8 · 钉钉+GitHub桥接';
    }
}

// ===== 健康检查 =====
async function healthCheck() {
    var res = await githubRequest('/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO);
    return {
        status: res.ok ? 'ok' : 'error',
        repo: GITHUB_OWNER + '/' + GITHUB_REPO,
        hasToken: !!GITHUB_TOKEN,
        apiReachable: res.ok,
        error: res.ok ? null : res.error
    };
}

module.exports = {
    handleGitHubCommand: handleGitHubCommand,
    getRepoStatus: getRepoStatus,
    listPRs: listPRs,
    listIssues: listIssues,
    listActions: listActions,
    triggerDeploy: triggerDeploy,
    healthCheck: healthCheck
};

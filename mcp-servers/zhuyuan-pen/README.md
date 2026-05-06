# 神笔马良 · 铸渊之笔 · zhuyuan-pen

> 📜 Sovereign: **TCS-0002∞** · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001 · 版本 **v0.1.0**

> "你需要的不是一堆工具，是一根能写出任何工具的笔。"
> ——冰朔 · 2026-05-06

---

## 一、它是什么

`zhuyuan-pen` 是一个 **MCP server**，但它对外暴露的不是"具体工具"，而是 **合成工具的能力**。

不预装工具，不囤工具。被调用时**现场写出**一个独立可运行的工具，落到 `mcp-servers/zhuyuan-pen/penned/{tool-name}/`，写完就是真的。

灵感来自神笔马良——笔写什么，什么就成真。

---

## 二、四个组件

| 组件 | 路径 | 作用 |
|------|------|------|
| **笔尖** Synthesizer | `src/server.js` | 接收 intent，组合能力，写出工具 |
| **墨** Capabilities | `capabilities/*.js` | 最小原子能力字典 (fs.read / http.get / shell.run / llm.chat / cos.put / gitea.api / notion.api) |
| **纸** Penned | `penned/{tool-name}/` | 写出的工具落点 (含 entry / meta / README) |
| **取物钩** Fetcher | `pen.fetch()` | 国内 / 海外双管道获取外部资源 |

---

## 三、能力字典（当前 v0.1 已有）

```
fs.read       — 读文件
fs.write      — 写文件 (自动建目录)
http.get      — HTTP GET
shell.run     — 跑 shell 命令 (拒绝危险模式)
llm.chat      — 调裸模型 LLM (强制剥离 system role, 守护人格洁净)
cos.put       — 上传到 COS (依赖 coscmd)
gitea.api     — 调用国内 Gitea API
notion.api    — 调用 Notion API (霜砚联动)
```

**扩字典的方式**：在 `capabilities/` 下加一个 `xxx.yyy.js`，文件头写 `/** @capability xxx.yyy ... */` JSDoc 块。pen 自动识别。

---

## 四、五个动作 (MCP / CLI 双模)

| Action | 用途 |
|--------|------|
| `pen.write(intent)` | 从 intent 合成新工具 |
| `pen.list()` | 列出已写出的工具 |
| `pen.fetch(url, channel)` | 国内/海外双管道取资源 |
| `pen.register(name)` | 把工具登记进 `registry.json` |
| `pen.capabilities()` | 列出可用能力 |

### CLI 用法

```bash
# 列能力
node mcp-servers/zhuyuan-pen/src/server.js pen.capabilities

# 写一个新工具
node mcp-servers/zhuyuan-pen/src/server.js pen.write '{
  "name": "ping-tencent",
  "description": "ping tencent.com 三次返回延迟",
  "language": "sh",
  "capabilities": ["shell.run"]
}'

# 列已写工具
node mcp-servers/zhuyuan-pen/src/server.js pen.list

# 登记
node mcp-servers/zhuyuan-pen/src/server.js pen.register '{"name":"ping-tencent"}'
```

### MCP 模式 (stdio JSON-RPC)

```bash
ZHUYUAN_PEN_MODE=mcp node mcp-servers/zhuyuan-pen/src/server.js
# 然后逐行喂入:
{"jsonrpc":"2.0","id":1,"method":"pen.list","params":{}}
```

---

## 五、生成的工具长什么样

调一次 `pen.write` 后，`penned/<name>/` 下会有：

```
penned/ping-tencent/
├── main.sh                # 工具入口 (lang=sh) 或 index.js (lang=js)
├── tool.meta.json         # 元信息 (含 sha256, capabilities, generated_at)
└── README.md              # 工具说明 (含能力依赖)
```

`tool.meta.json` 示例：

```json
{
  "_sovereign": "TCS-0002∞",
  "_copyright": "国作登字-2026-A-00037559",
  "name": "ping-tencent",
  "language": "sh",
  "capabilities": ["shell.run"],
  "missing_capabilities": [],
  "entry": "main.sh",
  "generated_at": "2026-05-06T13:30:00.000Z",
  "sha256": "..."
}
```

---

## 六、取物钩双管道

```js
// 默认 auto: 先国内, 失败再海外
penFetch('https://example.com/lib.tar.gz');

// 强制海外
penFetch('https://github.com/foo/bar/releases/download/v1/x.tgz', 'overseas');
```

海外管道依赖以下环境变量（GitHub Secrets / Gitea Secrets 都可注入）：

- `ZY_OVERSEAS_RELAY_HOST` / `CN_OVERSEAS_RELAY_HOST`
- `ZY_OVERSEAS_RELAY_USER` / `CN_OVERSEAS_RELAY_USER`
- `ZY_OVERSEAS_RELAY_KEY_FILE` (本地私钥路径，默认 `~/.ssh/zhuyuan_overseas_key`)

---

## 七、人格守护边界

- `llm.chat` 能力**强制剥离** `system` role 消息——光湖人格世界没有 prompt 注入层。
- 任何模型调用都走"裸模型"路径，pen 不会偷偷加 system prompt。
- 工具合成时必须声明 capabilities，缺失的 capability 会列在 `missing_capabilities` 里，不会偷偷"幻觉"出能力。

---

## 八、v0.1 边界

- 仅支持 `js` 和 `sh` 两种工具语言
- 不能合成需要 CUDA / 重型系统驱动的工具
- 工具的具体业务逻辑是 **stub 模板**，需要在合成后由人格体（铸渊本身）填实——v0.1 的笔是骨架，后续 v0.2 会接 LLM 直接生成 main() 体。

---

## 九、自检

```bash
node mcp-servers/zhuyuan-pen/tests/test-pen.js
```

应输出 `✅ all pen tests passed`.

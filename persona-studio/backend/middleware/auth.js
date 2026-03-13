/**
 * API 鉴权中间件 · BC-集成-005
 * 检查请求头 X-API-Key 是否匹配
 * 只保护 POST 写入接口，GET 查询不需要鉴权
 */
function apiAuth(req, res, next) {
 var apiKey = req.headers["x-api-key"];
 if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
 console.log("❌ 鉴权失败：", req.ip);
 return res.status(401).json({ error: "Unauthorized" });
 }
 next();
}

module.exports = apiAuth;
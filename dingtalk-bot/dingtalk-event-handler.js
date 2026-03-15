// 钉钉事件处理器 · dingtalk-event-handler.js · v1.0
// HoloLake · M-DINGTALK Phase 8
// DEV-004 之之 × 秋秋
// 功能：处理钉钉回调的完整事件格式
// 包括：消息回调、事件订阅验证、加密解密
//

var crypto = require('crypto');

// 钉钉回调加密/解密工具
function decryptCallback(encrypt, encodingAesKey) {
  try {
    if (!encodingAesKey) {
      console.log('[EventHandler] ⚠️ encodingAesKey未配置，跳过解密');
      return null;
    }
    // Base64解码AESKey（钉钉使用AES-256-CBC)
    var aesKey = Buffer.from(encodingAesKey + '=', 'base64');
    var iv = aesKey.slice(0,16);
    var decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(false);
    var decrypted = Buffer.concat([decipher.update(encrypt, 'base64'), decipher.final()]);
    // 去除PKCS7填充
    var padLen = decrypted[decrypted.length - 1];
    decrypted = decrypted.slice(0, decrypted.length - padLen);
    // 跳过16字节随机数 + 4字节消息长度
    var msgLen = decrypted.readInt32BE(16);
    var message = decrypted.slice(20, 20 + msgLen).toString('utf8');
    return message;
  } catch(err) {
    console.error('[EventHandler] 解密失败: ', err.message);
    return null;
  }
}

function encryptCallback(text, encodingAesKey, appKey) {
  try {
    if (!encodingAesKey) return null;
    var aesKey = Buffer.from(encodingAesKey + '=', 'base64');
    var iv = aesKey.slice(0,16);
    // 16字节随机数
    var random = crypto.randomBytes(16);
    var msgBuffer = Buffer.from(text, 'utf8');
    var lenBuffer = Buffer.alloc(4);
    lenBuffer.writeInt32BE(msgBuffer.length);
    var appKeyBuffer = Buffer.from(appKey || '', 'utf8');
    var plaintext = Buffer.concat([random, lenBuffer, msgBuffer, appKeyBuffer]);
    // PKCS7填充
    var blockSize = 32;
    var padLen = blockSize - (plaintext.length % blockSize);
    var padBuffer = Buffer.alloc(padLen, padLen);
    plaintext = Buffer.concat([plaintext, padBuffer]);

    var cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    cipher.setAutoPadding(false);
    var encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return encrypted.toString('base64');
  } catch (err) {
    console.error('[EventHandler] 加密失败: ', err.message);
    return null;
  }
}

// ===== 签名计算 =====

function computeSignature(token, timestamp, nonce, encrypt) {
  var arr = [token, timestamp, nonce, encrypt].sort();
  var str = arr.join('');
  return crypto.createHash('sha1').update(str).digest('hex');
}

// ===== 构建加密响应 =====

function buildEncryptedResponse(text, token, encodingAesKey, appKey) {
  var encrypt = encryptCallback(text, encodingAesKey, appKey);
  if (!encrypt) return { msg_signature: '', timeStamp: '', nonce: '', encrypt: '' };
  var timestamp = String(Date.now());
  var nonce = crypto.randomBytes(8).toString('hex');
  var signature = computeSignature(token, timestamp, nonce, encrypt);
  return {
    msg_signature: signature,
    timeStamp: timestamp,
    nonce: nonce,
    encrypt: encrypt
  };
}

// ===== 处理钉钉回调验证（注册回调时的check_url事件） =====
function handleVerify(body, config) {
  console.log('[EventHandler] 收到回调验证请求');
  var encrypt = body.encrypt;
  if (!encrypt) {
    // 非加密模式的简单验证
    return { success: true, challenge: body.challenge || 'ok'};
  }
  // 加密模式：解密 → 取challenge → 加密回传
  var decrypted = decryptCallback(encrypt, config.encodingAesKey);
  if (!decrypted) {
    return { success: true };
  }
  try {
    var eventData = JSON.parse(decrypted);
    if (eventData.EventType === 'check_url') {
      console.log('[EventHandler] check_url验证 → 返回加密success');
      return buildEncryptedResponse('success', config.token, config.encodingAesKey, config.appKey);
    }
    return { success: true };
  } catch (e) {
    return { success: true };
  }
}

// ====== 解析钉钉消息体 ======

function parseMessage(body, config) {
  // 情况1: 加密消息
  if (body.encrypt) {
    var decrypted = decryptCallback(body.encrypt, config.encodingAesKey);
    if (decrypted) {
      try {
        return JSON.parse(decrypted);
      } catch (e) {
        console.error('[EventHandler] 解密后JSON解析失败');
      }
    }
  }
  // 情况2: HTTP模式直接推送 (非加密)
  if (body.msgtype || body.text || body.conversationType) {
    return body;
  }
  // 情况3: 事件订阅格式
  if (body.EventType) {
    return body;
  }
  return body;
}

// ====== 提取消息内容 ======

function extractContent(parsed) {
  var result = {
    msgType: 'unknown',
    content: '',
    senderNick: '未知用户',
    senderId: '',
    conversationType: '1',
    conversationTitle: '',
    sessionWebhook: '',
    msgId: '',
    createAt: 0,
    isGroup: false,
    atUsers: []
  };

  // HTTP模式消息格式
  if (parsed.text) {
    result.msgType = parsed.msgtype || 'text';
    result.content = (parsed.text.content || '').trim();
    result.senderNick = parsed.senderNick || '未知用户';
    result.senderId = parsed.senderId || parsed.senderStaffId || '';
    result.conversationType = parsed.conversationType || '1';
    result.conversationTitle = parsed.conversationTitle || '';
    result.sessionWebhook = parsed.sessionWebhook || '';
    result.msgId = parsed.msgId || '';
    result.createAt = parsed.createAt || 0;
    result.isGroup = parsed.conversationType === '2';
    result.atUsers = parsed.atUsers || [];
  }
  // 事件订阅格式
  else if (parsed.EventType) {
    result.msgType = 'event';
    result.content = JSON.stringify(parsed);
  }

  return result;
}

module.exports = {
  decryptCallback: decryptCallback,
  encryptCallback: encryptCallback,
  computeSignature: computeSignature,
  buildEncryptedResponse: buildEncryptedResponse,
  handleVerify: handleVerify,
  parseMessage: parseMessage,
  extractContent: extractContent
};

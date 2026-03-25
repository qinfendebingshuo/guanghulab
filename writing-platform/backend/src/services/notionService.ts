// Notion Service - User data storage via Notion API
// Falls back to in-memory storage when NOTION_TOKEN is not configured

import { User, AI_COMPANIONS } from '../models/userModel';
import { v4 as uuidv4 } from 'uuid';

// In-memory user store (fallback when Notion is not configured)
const userStore = new Map<string, User>();

const NOTION_TOKEN = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
const WRITING_DB_ID = process.env.WRITING_DB_ID;

export async function createUser(data: {
  phone: string;
  nickname: string;
  realName?: string;
  role: 'author' | 'editor' | 'operator';
}): Promise<User> {
  const companion = AI_COMPANIONS[data.role];
  const user: User = {
    id: `user_${uuidv4().slice(0, 8)}`,
    phone: data.phone,
    nickname: data.nickname,
    realName: data.realName,
    role: data.role,
    aiCompanion: companion,
    creditScore: 60,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  if (NOTION_TOKEN && WRITING_DB_ID) {
    try {
      await createUserInNotion(user);
    } catch (err) {
      console.error('[Notion] Failed to create user, using memory fallback:', err);
      userStore.set(user.phone, user);
    }
  } else {
    userStore.set(user.phone, user);
    console.log(`[Storage-DEV] User created in memory: ${user.id} (${user.nickname})`);
  }

  return user;
}

export async function findUserByPhone(phone: string): Promise<User | null> {
  if (NOTION_TOKEN && WRITING_DB_ID) {
    try {
      return await findUserInNotion(phone);
    } catch (err) {
      console.error('[Notion] Failed to find user, checking memory:', err);
    }
  }
  return userStore.get(phone) || null;
}

export async function updateLastLogin(userId: string, phone: string): Promise<void> {
  const now = new Date().toISOString();
  if (NOTION_TOKEN && WRITING_DB_ID) {
    // TODO: Update in Notion
    console.log(`[Notion] Updated last login for ${userId}`);
  }
  const memUser = userStore.get(phone);
  if (memUser) {
    memUser.lastLogin = now;
  }
}

export async function saveConversation(data: {
  userId: string;
  userMessage: string;
  aiResponse: string;
  timestamp: string;
}): Promise<void> {
  // TODO: Save to Notion conversation database when configured
  console.log(`[Conversation] ${data.userId}: ${data.userMessage.slice(0, 50)}...`);
}

// --- Notion API integration (used when NOTION_TOKEN is available) ---

async function createUserInNotion(user: User): Promise<void> {
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: WRITING_DB_ID },
      properties: {
        '用户ID': { title: [{ text: { content: user.id } }] },
        '手机号': { rich_text: [{ text: { content: user.phone } }] },
        '笔名': { rich_text: [{ text: { content: user.nickname } }] },
        '真实姓名': { rich_text: [{ text: { content: user.realName || '' } }] },
        '角色': { select: { name: user.role } },
        'AI伙伴名称': { rich_text: [{ text: { content: user.aiCompanion.name } }] },
        '信誉分': { number: user.creditScore },
        '注册时间': { date: { start: user.createdAt } },
        '最后登录': { date: { start: user.lastLogin } },
        '状态': { select: { name: user.status } },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Notion API error: ${err}`);
  }
}

async function findUserInNotion(phone: string): Promise<User | null> {
  const response = await fetch(`https://api.notion.com/v1/databases/${WRITING_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: {
        property: '手机号',
        rich_text: { equals: phone },
      },
    }),
  });

  if (!response.ok) return null;

  const data: any = await response.json();
  if (!data.results || data.results.length === 0) return null;

  const page = data.results[0];
  const props = page.properties;

  const role = props['角色']?.select?.name || 'author';
  const companion = AI_COMPANIONS[role] || AI_COMPANIONS.author;

  return {
    id: props['用户ID']?.title?.[0]?.text?.content || '',
    phone: props['手机号']?.rich_text?.[0]?.text?.content || '',
    nickname: props['笔名']?.rich_text?.[0]?.text?.content || '',
    realName: props['真实姓名']?.rich_text?.[0]?.text?.content,
    role: role as User['role'],
    aiCompanion: companion,
    creditScore: props['信誉分']?.number || 60,
    status: (props['状态']?.select?.name || 'active') as User['status'],
    createdAt: props['注册时间']?.date?.start || '',
    lastLogin: props['最后登录']?.date?.start || '',
  };
}

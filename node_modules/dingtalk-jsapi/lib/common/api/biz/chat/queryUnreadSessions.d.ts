export declare const apiName = "biz.chat.queryUnreadSessions";
/**
 * 根据会话类型和会话tag计算有未读消息的会话数量， 注意:此数量是客户端缓存的会话数量 请求参数定义
 * @apiName biz.chat.queryUnreadSessions
 */
export interface IBizChatQueryUnreadSessionsParams {
    /** 会话类型 1 单聊 */
    type: number;
    /** 会话标签 16 新零售 */
    tag: number;
}
/**
 * 根据会话类型和会话tag计算有未读消息的会话数量， 注意:此数量是客户端缓存的会话数量. 返回结果定义
 * @apiName biz.chat.queryUnreadSessions
 */
export interface IBizChatQueryUnreadSessionsResult {
    /** 有未读消息的会话数量 */
    count: number;
}
/**
 * 根据会话类型和会话tag计算有未读消息的会话数量， 注意:此数量是客户端缓存的会话数量.
 * @apiName biz.chat.queryUnreadSessions
 * @supportVersion ios: 4.5.0 android: 4.5.0
 */
export declare function queryUnreadSessions$(params: IBizChatQueryUnreadSessionsParams): Promise<IBizChatQueryUnreadSessionsResult>;
export default queryUnreadSessions$;

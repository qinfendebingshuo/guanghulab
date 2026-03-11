export declare const apiName = "biz.util.acitveConversation";
/**
 * 激活会话窗口 请求参数定义
 * @apiName biz.util.acitveConversation
 */
export interface IBizUtilAcitveConversationParams {
    cid: string;
    messageId?: string;
    keyword?: string;
    createdAt?: string;
}
/**
 * 激活会话窗口 返回结果定义
 * @apiName biz.util.acitveConversation
 */
export interface IBizUtilAcitveConversationResult {
}
/**
 * 激活会话窗口
 * @apiName biz.util.acitveConversation
 * @supportVersion win: 6.0.8 mac: 6.0.8
 * @author win:周镛 mac:伯温
 */
export declare function acitveConversation$(params: IBizUtilAcitveConversationParams): Promise<IBizUtilAcitveConversationResult>;
export default acitveConversation$;

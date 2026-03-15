export declare const apiName = "internal.chat.toConversation";
/**
 * 跳转到会话 请求参数定义
 * @apiName internal.chat.toConversation
 */
export interface IInternalChatToConversationParams {
    cid: string;
}
/**
 * 跳转到会话 返回结果定义
 * @apiName internal.chat.toConversation
 */
export interface IInternalChatToConversationResult {
}
/**
 * 跳转到会话
 * @apiName internal.chat.toConversation
 * @supportVersion ios: 4.6.8 android: 4.6.8
 */
export declare function toConversation$(params: IInternalChatToConversationParams): Promise<IInternalChatToConversationResult>;
export default toConversation$;

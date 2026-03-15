export declare const apiName = "internal.chat.pickGroupConversation";
/**
 * 获取群会话 请求参数定义
 * @apiName internal.chat.pickGroupConversation
 */
export interface IInternalChatPickGroupConversationParams {
    /** （default：-1）业务类型 1: 普通选群组 2: 添加机器人选群组 */
    bizType: number;
    /** （default：0）机器人模板 */
    templateId?: number;
    /** 是否只展示企业群 */
    enterprise?: boolean;
    /** 是否只展示自己创建的企业群 针对Android：当enterprise为true时有效。默认true，所以需要前端按需传参。 */
    owner?: boolean;
}
/**
 * 获取群会话 返回结果定义
 * @apiName internal.chat.pickGroupConversation
 */
export interface IInternalChatPickGroupConversationResult {
    /** 会话id */
    cid: string;
    /** 会话名 */
    conversationName: string;
}
/**
 * 获取群会话
 * @apiName internal.chat.pickGroupConversation
 * @supportVersion  ios: 3.3.3 android: 3.3.3 pc: 4.6.1
 * @author ios: 慕桥, android: 峰砺
 */
export declare function pickGroupConversation$(params: IInternalChatPickGroupConversationParams): Promise<IInternalChatPickGroupConversationResult>;
export default pickGroupConversation$;

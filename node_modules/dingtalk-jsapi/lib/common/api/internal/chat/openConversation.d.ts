export declare const apiName = "internal.chat.openConversation";
/**
 * 内部H5打开指定的单聊会话，并可以附带一条消息 请求参数定义
 * @apiName internal.chat.openConversation
 */
export interface IInternalChatOpenConversationParams {
    [key: string]: any;
}
/**
 * 内部H5打开指定的单聊会话，并可以附带一条消息 返回结果定义
 * @apiName internal.chat.openConversation
 */
export interface IInternalChatOpenConversationResult {
    [key: string]: any;
}
/**
 * 内部H5打开指定的单聊会话，并可以附带一条消息
 * @apiName internal.chat.openConversation
 * @supportVersion  ios: 3.4.1 android: 3.4.1
 */
export declare function openConversation$(params: IInternalChatOpenConversationParams): Promise<IInternalChatOpenConversationResult>;
export default openConversation$;

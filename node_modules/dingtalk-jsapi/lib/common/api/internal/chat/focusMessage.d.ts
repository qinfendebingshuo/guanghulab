export declare const apiName = "internal.chat.focusMessage";
/**
 * 根据messageId在会话页面跳转到对应的位置 请求参数定义
 * @apiName internal.chat.focusMessage
 */
export interface IInternalChatFocusMessageParams {
    messageId: number;
    conversationId: string;
}
/**
 * 根据messageId在会话页面跳转到对应的位置 返回结果定义
 * @apiName internal.chat.focusMessage
 */
export interface IInternalChatFocusMessageResult {
}
/**
 * 根据messageId在会话页面跳转到对应的位置
 * @apiName internal.chat.focusMessage
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function focusMessage$(params: IInternalChatFocusMessageParams): Promise<IInternalChatFocusMessageResult>;
export default focusMessage$;

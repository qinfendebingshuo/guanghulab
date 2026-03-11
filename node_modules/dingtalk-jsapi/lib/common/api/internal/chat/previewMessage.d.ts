export declare const apiName = "internal.chat.previewMessage";
/**
 * 根据messageId跳转消息详情页 请求参数定义
 * @apiName internal.chat.previewMessage
 */
export interface IInternalChatPreviewMessageParams {
    messageId: number;
    conversationId: string;
}
/**
 * 根据messageId跳转消息详情页 返回结果定义
 * @apiName internal.chat.previewMessage
 */
export interface IInternalChatPreviewMessageResult {
}
/**
 * 根据messageId跳转消息详情页
 * @apiName internal.chat.previewMessage
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function previewMessage$(params: IInternalChatPreviewMessageParams): Promise<IInternalChatPreviewMessageResult>;
export default previewMessage$;

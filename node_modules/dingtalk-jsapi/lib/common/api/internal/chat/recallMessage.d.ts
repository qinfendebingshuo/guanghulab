export declare const apiName = "internal.chat.recallMessage";
/**
 * 根据messageId撤回对应的消息 请求参数定义
 * @apiName internal.chat.recallMessage
 */
export interface IInternalChatRecallMessageParams {
    messageId: number;
    conversationId: string;
}
/**
 * 根据messageId撤回对应的消息 返回结果定义
 * @apiName internal.chat.recallMessage
 */
export interface IInternalChatRecallMessageResult {
}
/**
 * 根据messageId撤回对应的消息
 * @apiName internal.chat.recallMessage
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function recallMessage$(params: IInternalChatRecallMessageParams): Promise<IInternalChatRecallMessageResult>;
export default recallMessage$;

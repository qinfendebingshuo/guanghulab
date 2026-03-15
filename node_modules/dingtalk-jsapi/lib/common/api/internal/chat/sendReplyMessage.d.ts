export declare const apiName = "internal.chat.sendReplyMessage";
/**
 * 发送文本回复消息 请求参数定义
 * @apiName internal.chat.sendReplyMessage
 */
export interface IInternalChatSendReplyMessageParams {
    /** 会话id， */
    conversationId: string;
    /** 引文的消息id */
    sourceMessageId: number;
    /** 发送的文本内容 */
    messageContent: string;
    /** at选人集合，map类型 < uid，昵称 > */
    at: {
        [uid: number]: string;
    };
}
/**
 * 发送文本回复消息 返回结果定义
 * @apiName internal.chat.sendReplyMessage
 */
export interface IInternalChatSendReplyMessageResult {
}
/**
 * 发送文本回复消息
 * @apiName internal.chat.sendReplyMessage
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function sendReplyMessage$(params: IInternalChatSendReplyMessageParams): Promise<IInternalChatSendReplyMessageResult>;
export default sendReplyMessage$;

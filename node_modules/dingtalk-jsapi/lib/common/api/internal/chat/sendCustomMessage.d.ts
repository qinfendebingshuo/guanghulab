export declare const apiName = "internal.chat.sendCustomMessage";
/**
 * 发送定制消息到某个会话聊天 请求参数定义
 * @apiName internal.chat.sendCustomMessage
 */
export interface IInternalChatSendCustomMessageParams {
    /** 会话id */
    cid: string;
    /** 定制文本 */
    text: string;
    /** @人员列表 格式： {"uid":"nickname", "xxx":"xxx"} */
    atOpenIds?: {
        [uid: string]: string;
    };
}
/**
 * 发送定制消息到某个会话聊天 返回结果定义
 * @apiName internal.chat.sendCustomMessage
 */
export interface IInternalChatSendCustomMessageResult {
}
/**
 * 发送定制消息到某个会话聊天
 * @apiName internal.chat.sendCustomMessage
 * @supportVersion ios: 4.6.34 android: 4.6.34
 */
export declare function sendCustomMessage$(params: IInternalChatSendCustomMessageParams): Promise<IInternalChatSendCustomMessageResult>;
export default sendCustomMessage$;

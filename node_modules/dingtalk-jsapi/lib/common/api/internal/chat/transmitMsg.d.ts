export declare const apiName = "internal.chat.transmitMsg";
/**
 * 将部分信息传递到IM会话，以link类型消息发送 请求参数定义
 * @apiName internal.chat.transmitMsg
 */
export interface IInternalChatTransmitMsgParams {
    [key: string]: any;
}
/**
 * 将部分信息传递到IM会话，以link类型消息发送 返回结果定义
 * @apiName internal.chat.transmitMsg
 */
export interface IInternalChatTransmitMsgResult {
    [key: string]: any;
}
/**
 * 将部分信息传递到IM会话，以link类型消息发送
 * @apiName internal.chat.transmitMsg
 * @supportVersion  ios: 3.4.10 android: 3.4.10
 */
export declare function transmitMsg$(params: IInternalChatTransmitMsgParams): Promise<IInternalChatTransmitMsgResult>;
export default transmitMsg$;

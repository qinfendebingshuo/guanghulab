export declare const apiName = "internal.chat.sendBizMessage";
/**
 * 开放平台内部调用，发送自定义业务类型消息 请求参数定义
 * @apiName internal.chat.sendBizMessage
 */
export interface IInternalChatSendBizMessageParams {
    cid: string;
    bizType: number;
    bizArgs: string;
}
/**
 * 开放平台内部调用，发送自定义业务类型消息 返回结果定义
 * @apiName internal.chat.sendBizMessage
 */
export interface IInternalChatSendBizMessageResult {
}
/**
 * 开放平台内部调用，发送自定义业务类型消息
 * @apiName internal.chat.sendBizMessage
 * @supportVersion ios: 5.1.6 android: 5.1.6 pc: 5.1.6
 * @author windows:仟晨 iOS:鱼非 Android:风沂 Mac:舒绎
 */
export declare function sendBizMessage$(params: IInternalChatSendBizMessageParams): Promise<IInternalChatSendBizMessageResult>;
export default sendBizMessage$;

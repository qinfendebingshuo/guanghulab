export declare const apiName = "internal.chat.sendMultiMsges";
/**
 * 供钉钉自有H5业务批量发送消息 请求参数定义
 * @apiName internal.chat.sendMultiMsges
 */
export interface IInternalChatSendMultiMsgesParams {
    [key: string]: any;
}
/**
 * 供钉钉自有H5业务批量发送消息 返回结果定义
 * @apiName internal.chat.sendMultiMsges
 */
export interface IInternalChatSendMultiMsgesResult {
    [key: string]: any;
}
/**
 * 供钉钉自有H5业务批量发送消息
 * @apiName internal.chat.sendMultiMsges
 * @supportVersion  ios: 3.5.1 android: 3.5.1 pc: 5.1.30
 * @author windows: 修心 mac: 修心
 */
export declare function sendMultiMsges$(params: IInternalChatSendMultiMsgesParams): Promise<IInternalChatSendMultiMsgesResult>;
export default sendMultiMsges$;

export declare const apiName = "internal.chat.selectAndSendText";
/**
 * 调用选会话组件并发送@人文字消息 请求参数定义
 * @apiName internal.chat.selectAndSendText
 */
export interface IInternalChatSelectAndSendTextParams {
    [key: string]: any;
}
/**
 * 调用选会话组件并发送@人文字消息 返回结果定义
 * @apiName internal.chat.selectAndSendText
 */
export interface IInternalChatSelectAndSendTextResult {
    [key: string]: any;
}
/**
 * 调用选会话组件并发送@人文字消息
 * @apiName internal.chat.selectAndSendText
 * @supportVersion  ios: 3.4.6 android: 3.4.6
 */
export declare function selectAndSendText$(params: IInternalChatSelectAndSendTextParams): Promise<IInternalChatSelectAndSendTextResult>;
export default selectAndSendText$;

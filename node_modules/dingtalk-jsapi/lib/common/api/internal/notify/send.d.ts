export declare const apiName = "internal.notify.send";
/**
 * 消息通知H5到Native 请求参数定义
 * @apiName internal.notify.send
 */
export interface IInternalNotifySendParams {
    [key: string]: any;
}
/**
 * 消息通知H5到Native 返回结果定义
 * @apiName internal.notify.send
 */
export interface IInternalNotifySendResult {
    [key: string]: any;
}
/**
 * 消息通知H5到Native
 * @apiName internal.notify.send
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function send$(params: IInternalNotifySendParams): Promise<IInternalNotifySendResult>;
export default send$;

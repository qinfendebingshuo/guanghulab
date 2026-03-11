export declare const apiName = "biz.notify.send";
/**
 * 消息通知H5到Native 请求参数定义
 * @apiName biz.notify.send
 */
export interface IBizNotifySendParams {
    [key: string]: any;
}
/**
 * 消息通知H5到Native 返回结果定义
 * @apiName biz.notify.send
 */
export interface IBizNotifySendResult {
    [key: string]: any;
}
/**
 * 消息通知H5到Native
 * @apiName biz.notify.send
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function send$(params: IBizNotifySendParams): Promise<IBizNotifySendResult>;
export default send$;

export declare const apiName = "internal.channel.unsubscribe";
/**
 * 向统一事件框架取消订阅事件监听 请求参数定义
 * @apiName internal.channel.unsubscribe
 */
export interface IInternalChannelUnsubscribeParams {
    /** 通道名称 */
    namespace: string;
    /** 事件名称 */
    eventName: string;
}
/**
 * 向统一事件框架取消订阅事件监听 返回结果定义
 * @apiName internal.channel.unsubscribe
 */
export interface IInternalChannelUnsubscribeResult {
    [key: string]: any;
}
/**
 * 向统一事件框架取消订阅事件监听
 * @description 请不要单独使用此接口，而是使用uniEvent plugin来监听
 * @apiName internal.channel.unsubscribe
 * @supportVersion ios: 4.6.1 android: 4.6.1
 */
export declare function unsubscribe$(params: IInternalChannelUnsubscribeParams): Promise<IInternalChannelUnsubscribeResult>;
export default unsubscribe$;

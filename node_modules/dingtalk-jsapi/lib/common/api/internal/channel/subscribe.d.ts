export declare const apiName = "internal.channel.subscribe";
/**
 * 向统一事件框架订阅事件监听 请求参数定义
 * @apiName internal.channel.subscribe
 */
export interface IInternalChannelSubscribeParams {
    /** 通道名称 */
    namespace: string;
    /** 事件名称 */
    eventName: string;
}
/**
 * 向统一事件框架订阅事件监听 返回结果定义
 * @apiName internal.channel.subscribe
 */
export declare type IInternalChannelSubscribeResult = {
    /** 通道名称 */
    namespace: string;
    /** 事件名称 */
    eventName: string;
    /** 数据，可为空 */
    data?: any;
    /** 是否是缓存数据 */
    isCached: boolean;
    /** 缓存时间戳，单位ms */
    cacheTimestamp: number;
} | {};
/**
 * 向统一事件框架订阅事件监听
 * @description 请不要单独使用此接口，而是使用uniEvent plugin来监听
 * @apiName internal.channel.subscribe
 * @supportVersion ios: 4.6.1 android: 4.6.1
 */
export declare function subscribe$(params: IInternalChannelSubscribeParams): Promise<IInternalChannelSubscribeResult>;
export default subscribe$;

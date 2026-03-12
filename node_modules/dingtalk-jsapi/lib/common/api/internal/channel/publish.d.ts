export declare const apiName = "internal.channel.publish";
/**
 * 向统一事件框架发送事件消息 请求参数定义
 * @apiName internal.channel.publish
 */
export interface IInternalChannelPublishParams {
    /** 通道名称 */
    namespace: string;
    /** 事件名称 */
    eventName: string;
    /** 数据，可为空 */
    data?: any;
    /** 是需要缓存 */
    shouldUpdateCache: boolean;
}
/**
 * 向统一事件框架发送事件消息 返回结果定义
 * @apiName internal.channel.publish
 */
export interface IInternalChannelPublishResult {
    [key: string]: any;
}
/**
 * 向统一事件框架发送事件消息
 * @apiName internal.channel.publish
 * @supportVersion ios: 4.6.1 android: 4.6.1
 */
export declare function publish$(params: IInternalChannelPublishParams): Promise<IInternalChannelPublishResult>;
export default publish$;

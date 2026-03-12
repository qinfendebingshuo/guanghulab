export declare const apiName = "internal.live.startLive";
/**
 * 发起直播， 支持传入多个cid，端上选择第一个创建直播，之后将其他群关联到该直播 请求参数定义
 * @apiName internal.live.startLive
 */
export interface IInternalLiveStartLiveParams {
    /** 将要发起直播的群 */
    cidList: string[];
}
/**
 * 发起直播， 支持传入多个cid，端上选择第一个创建直播，之后将其他群关联到该直播 返回结果定义
 * @apiName internal.live.startLive
 */
export interface IInternalLiveStartLiveResult {
    [key: string]: any;
}
/**
 * 发起直播， 支持传入多个cid，端上选择第一个创建直播，之后将其他群关联到该直播
 * @apiName internal.live.startLive
 * @supportVersion ios: 4.7.13 android: 4.7.13
 * @author Android: 朴文; IOS: 云信
 */
export declare function startLive$(params: IInternalLiveStartLiveParams): Promise<IInternalLiveStartLiveResult>;
export default startLive$;

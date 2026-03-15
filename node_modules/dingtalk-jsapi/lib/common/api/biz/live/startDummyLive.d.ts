export declare const apiName = "biz.live.startDummyLive";
/**
 * 分享大直播到某个群 请求参数定义
 * @apiName biz.live.startDummyLive
 */
export interface IBizLiveStartDummyLiveParams {
    [key: string]: any;
}
/**
 * 分享大直播到某个群 返回结果定义
 * @apiName biz.live.startDummyLive
 */
export interface IBizLiveStartDummyLiveResult {
    [key: string]: any;
}
/**
 * 分享大直播到某个群
 * @apiName biz.live.startDummyLive
 * @supportVersion pc: 4.5.5
 */
export declare function startDummyLive$(params: IBizLiveStartDummyLiveParams): Promise<IBizLiveStartDummyLiveResult>;
export default startDummyLive$;

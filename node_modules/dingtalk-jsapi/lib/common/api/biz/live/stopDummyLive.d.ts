export declare const apiName = "biz.live.stopDummyLive";
/**
 * 停止分享大直播到某个群 请求参数定义
 * @apiName biz.live.stopDummyLive
 */
export interface IBizLiveStopDummyLiveParams {
    [key: string]: any;
}
/**
 * 停止分享大直播到某个群 返回结果定义
 * @apiName biz.live.stopDummyLive
 */
export interface IBizLiveStopDummyLiveResult {
    [key: string]: any;
}
/**
 * 停止分享大直播到某个群
 * @apiName biz.live.stopDummyLive
 * @supportVersion pc: 4.5.5
 */
export declare function stopDummyLive$(params: IBizLiveStopDummyLiveParams): Promise<IBizLiveStopDummyLiveResult>;
export default stopDummyLive$;

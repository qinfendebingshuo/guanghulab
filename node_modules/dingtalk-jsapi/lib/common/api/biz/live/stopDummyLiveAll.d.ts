export declare const apiName = "biz.live.stopDummyLiveAll";
/**
 * 停止分享大直播到某些群 请求参数定义
 * @apiName biz.live.stopDummyLiveAll
 */
export interface IBizLiveStopDummyLiveAllParams {
    [key: string]: any;
}
/**
 * 停止分享大直播到某些群 返回结果定义
 * @apiName biz.live.stopDummyLiveAll
 */
export interface IBizLiveStopDummyLiveAllResult {
    [key: string]: any;
}
/**
 * 停止分享大直播到某些群
 * @apiName biz.live.stopDummyLiveAll
 * @supportVersion pc: 4.5.5
 */
export declare function stopDummyLiveAll$(params: IBizLiveStopDummyLiveAllParams): Promise<IBizLiveStopDummyLiveAllResult>;
export default stopDummyLiveAll$;

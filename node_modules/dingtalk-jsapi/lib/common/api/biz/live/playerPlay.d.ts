export declare const apiName = "biz.live.playerPlay";
/**
 * 直播播放器播放 请求参数定义
 * @apiName biz.live.playerPlay
 */
export interface IBizLivePlayerPlayParams {
    [key: string]: any;
}
/**
 * 直播播放器播放 返回结果定义
 * @apiName biz.live.playerPlay
 */
export interface IBizLivePlayerPlayResult {
    [key: string]: any;
}
/**
 * 直播播放器播放
 * @apiName biz.live.playerPlay
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function playerPlay$(params: IBizLivePlayerPlayParams): Promise<IBizLivePlayerPlayResult>;
export default playerPlay$;

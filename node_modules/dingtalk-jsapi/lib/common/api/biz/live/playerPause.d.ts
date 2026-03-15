export declare const apiName = "biz.live.playerPause";
/**
 * 直播播放器暂停 请求参数定义
 * @apiName biz.live.playerPause
 */
export interface IBizLivePlayerPauseParams {
    [key: string]: any;
}
/**
 * 直播播放器暂停 返回结果定义
 * @apiName biz.live.playerPause
 */
export interface IBizLivePlayerPauseResult {
    [key: string]: any;
}
/**
 * 直播播放器暂停
 * @apiName biz.live.playerPause
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function playerPause$(params: IBizLivePlayerPauseParams): Promise<IBizLivePlayerPauseResult>;
export default playerPause$;

export declare const apiName = "biz.live.hidePlayer";
/**
 * 隐藏直播播放器 请求参数定义
 * @apiName biz.live.hidePlayer
 */
export interface IBizLiveHidePlayerParams {
    [key: string]: any;
}
/**
 * 隐藏直播播放器 返回结果定义
 * @apiName biz.live.hidePlayer
 */
export interface IBizLiveHidePlayerResult {
    [key: string]: any;
}
/**
 * 隐藏直播播放器
 * @apiName biz.live.hidePlayer
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function hidePlayer$(params: IBizLiveHidePlayerParams): Promise<IBizLiveHidePlayerResult>;
export default hidePlayer$;

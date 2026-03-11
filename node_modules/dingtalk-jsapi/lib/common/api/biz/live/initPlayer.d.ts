export declare const apiName = "biz.live.initPlayer";
/**
 * 初始化直播播放器 请求参数定义
 * @apiName biz.live.initPlayer
 */
export interface IBizLiveInitPlayerParams {
    [key: string]: any;
}
/**
 * 初始化直播播放器 返回结果定义
 * @apiName biz.live.initPlayer
 */
export interface IBizLiveInitPlayerResult {
    [key: string]: any;
}
/**
 * 初始化直播播放器
 * @apiName biz.live.initPlayer
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function initPlayer$(params: IBizLiveInitPlayerParams): Promise<IBizLiveInitPlayerResult>;
export default initPlayer$;

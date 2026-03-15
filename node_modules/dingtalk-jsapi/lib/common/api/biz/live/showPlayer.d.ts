export declare const apiName = "biz.live.showPlayer";
/**
 * 展示直播播放器 请求参数定义
 * @apiName biz.live.showPlayer
 */
export interface IBizLiveShowPlayerParams {
    [key: string]: any;
}
/**
 * 展示直播播放器 返回结果定义
 * @apiName biz.live.showPlayer
 */
export interface IBizLiveShowPlayerResult {
    [key: string]: any;
}
/**
 * 展示直播播放器
 * @apiName biz.live.showPlayer
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function showPlayer$(params: IBizLiveShowPlayerParams): Promise<IBizLiveShowPlayerResult>;
export default showPlayer$;

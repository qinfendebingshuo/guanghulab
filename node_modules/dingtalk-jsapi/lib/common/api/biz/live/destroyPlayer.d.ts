export declare const apiName = "biz.live.destroyPlayer";
/**
 * 销毁播放器 请求参数定义
 * @apiName biz.live.destroyPlayer
 */
export interface IBizLiveDestroyPlayerParams {
    [key: string]: any;
}
/**
 * 销毁播放器 返回结果定义
 * @apiName biz.live.destroyPlayer
 */
export interface IBizLiveDestroyPlayerResult {
    [key: string]: any;
}
/**
 * 销毁播放器
 * @apiName biz.live.destroyPlayer
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function destroyPlayer$(params: IBizLiveDestroyPlayerParams): Promise<IBizLiveDestroyPlayerResult>;
export default destroyPlayer$;

export declare const apiName = "biz.live.updateDrawingCache";
/**
 * 大型直播页面刷新View Cache 请求参数定义
 * @apiName biz.live.updateDrawingCache
 */
export interface IBizLiveUpdateDrawingCacheParams {
}
/**
 * 大型直播页面刷新View Cache 返回结果定义
 * @apiName biz.live.updateDrawingCache
 */
export interface IBizLiveUpdateDrawingCacheResult {
}
/**
 * 大型直播页面刷新View Cache
 * @apiName biz.live.updateDrawingCache
 * @supportVersion android: 4.3.7
 */
export declare function updateDrawingCache$(params: IBizLiveUpdateDrawingCacheParams): Promise<IBizLiveUpdateDrawingCacheResult>;
export default updateDrawingCache$;

export declare const apiName = "biz.live.getStickyStatus";
/**
 * 查询群直播功能会话置顶状态 请求参数定义
 * @apiName biz.live.getStickyStatus
 */
export interface IBizLiveGetStickyStatusParams {
    [key: string]: any;
}
/**
 * 查询群直播功能会话置顶状态 返回结果定义
 * @apiName biz.live.getStickyStatus
 */
export interface IBizLiveGetStickyStatusResult {
    status: boolean;
}
/**
 * 查询群直播功能会话置顶状态
 * @apiName biz.live.getStickyStatus
 * @supportVersion ios: 4.6.0 android: 4.6.0
 */
export declare function getStickyStatus$(params: IBizLiveGetStickyStatusParams): Promise<IBizLiveGetStickyStatusResult>;
export default getStickyStatus$;

export declare const apiName = "biz.live.setStickyStatus";
/**
 * 设置群直播功能会话置顶状态 请求参数定义
 * @apiName biz.live.setStickyStatus
 */
export interface IBizLiveSetStickyStatusParams {
    status: boolean;
}
/**
 * 设置群直播功能会话置顶状态 返回结果定义
 * @apiName biz.live.setStickyStatus
 */
export interface IBizLiveSetStickyStatusResult {
    [key: string]: any;
}
/**
 * 设置群直播功能会话置顶状态
 * @apiName biz.live.setStickyStatus
 * @supportVersion ios: 4.6.0 android: 4.6.0
 */
export declare function setStickyStatus$(params: IBizLiveSetStickyStatusParams): Promise<IBizLiveSetStickyStatusResult>;
export default setStickyStatus$;

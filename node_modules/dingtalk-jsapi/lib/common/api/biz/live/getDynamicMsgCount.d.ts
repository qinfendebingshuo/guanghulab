export declare const apiName = "biz.live.getDynamicMsgCount";
/**
 * 获取直播动态消息数 请求参数定义
 * @apiName biz.live.getDynamicMsgCount
 */
export interface IBizLiveGetDynamicMsgCountParams {
    [key: string]: any;
}
/**
 * 获取直播动态消息数 返回结果定义
 * @apiName biz.live.getDynamicMsgCount
 */
export interface IBizLiveGetDynamicMsgCountResult {
    /** 未读动态数 */
    count: number;
}
/**
 * 获取直播动态消息数
 * @apiName biz.live.getDynamicMsgCount
 * @supportVersion ios: 4.6.10 android: 4.6.10
 */
export declare function getDynamicMsgCount$(params: IBizLiveGetDynamicMsgCountParams): Promise<IBizLiveGetDynamicMsgCountResult>;
export default getDynamicMsgCount$;

export declare const apiName = "biz.live.getLiveInfos";
/**
 * 获取群直播的状态信息 请求参数定义
 * @apiName biz.live.getLiveInfos
 */
export interface IBizLiveGetLiveInfosParams {
    [key: string]: any;
}
/**
 * 获取群直播的状态信息 返回结果定义
 * @apiName biz.live.getLiveInfos
 */
export interface IBizLiveGetLiveInfosResult {
    [key: string]: any;
}
/**
 * 获取群直播的状态信息
 * @apiName biz.live.getLiveInfos
 * @supportVersion pc: 4.5.5
 */
export declare function getLiveInfos$(params: IBizLiveGetLiveInfosParams): Promise<IBizLiveGetLiveInfosResult>;
export default getLiveInfos$;

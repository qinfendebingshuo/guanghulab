export declare const apiName = "biz.live.getLiveStatistics";
/**
 * 获取录播统计信息 请求参数定义
 * @apiName biz.live.getLiveStatistics
 */
export interface IBizLiveGetLiveStatisticsParams {
    [key: string]: any;
}
/**
 * 获取录播统计信息 返回结果定义
 * @apiName biz.live.getLiveStatistics
 */
export interface IBizLiveGetLiveStatisticsResult {
    [key: string]: any;
}
/**
 * 获取录播统计信息
 * @apiName biz.live.getLiveStatistics
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function getLiveStatistics$(params: IBizLiveGetLiveStatisticsParams): Promise<IBizLiveGetLiveStatisticsResult>;
export default getLiveStatistics$;

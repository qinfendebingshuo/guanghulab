export declare const apiName = "biz.sports.fetchStephubSteps";
/**
 * 从步数中心获取步数 请求参数定义
 * @apiName biz.sports.fetchStephubSteps
 */
export interface IBizSportsFetchStephubStepsParams {
    statDate: string;
}
/**
 * 从步数中心获取步数 返回结果定义
 * @apiName biz.sports.fetchStephubSteps
 */
export interface IBizSportsFetchStephubStepsResult {
    count: number;
    timestamp: number;
}
/**
 * 从步数中心获取步数
 * @apiName biz.sports.fetchStephubSteps
 * @supportVersion ios: 4.5.16 android: 4.5.16
 */
export declare function fetchStephubSteps$(params: IBizSportsFetchStephubStepsParams): Promise<IBizSportsFetchStephubStepsResult>;
export default fetchStephubSteps$;

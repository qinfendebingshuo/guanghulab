export declare const apiName = "internal.health.getTodaysStepCount";
/**
 * 获取用户当天0：00至当前时间的总步数 请求参数定义
 * @apiName internal.health.getTodaysStepCount
 */
export interface IInternalHealthGetTodaysStepCountParams {
    [key: string]: any;
}
/**
 * 获取用户当天0：00至当前时间的总步数 返回结果定义
 * @apiName internal.health.getTodaysStepCount
 */
export interface IInternalHealthGetTodaysStepCountResult {
    [key: string]: any;
}
/**
 * 获取用户当天0：00至当前时间的总步数
 * @apiName internal.health.getTodaysStepCount
 * @supportVersion  ios: 3.4.1 android: 3.4.1
 */
export declare function getTodaysStepCount$(params: IInternalHealthGetTodaysStepCountParams): Promise<IInternalHealthGetTodaysStepCountResult>;
export default getTodaysStepCount$;

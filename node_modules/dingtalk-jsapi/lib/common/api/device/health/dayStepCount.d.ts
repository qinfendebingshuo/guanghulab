export declare const apiName = "device.health.dayStepCount";
/**
 * 健康每日数据 请求参数定义
 * @apiName device.health.dayStepCount
 */
export interface IDeviceHealthDayStepCountParams {
    [key: string]: any;
}
/**
 * 健康每日数据 返回结果定义
 * @apiName device.health.dayStepCount
 */
export interface IDeviceHealthDayStepCountResult {
    [key: string]: any;
}
/**
 * 健康每日数据
 * @apiName device.health.dayStepCount
 * @supportVersion  ios: 2.11.0 android: 2.11.0
 */
export declare function dayStepCount$(params: IDeviceHealthDayStepCountParams): Promise<IDeviceHealthDayStepCountResult>;
export default dayStepCount$;

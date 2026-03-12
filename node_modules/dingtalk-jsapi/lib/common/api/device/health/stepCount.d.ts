export declare const apiName = "device.health.stepCount";
/**
 * 健康步数 请求参数定义
 * @apiName device.health.stepCount
 */
export interface IDeviceHealthStepCountParams {
    [key: string]: any;
}
/**
 * 健康步数 返回结果定义
 * @apiName device.health.stepCount
 */
export interface IDeviceHealthStepCountResult {
    [key: string]: any;
}
/**
 * 健康步数
 * @apiName device.health.stepCount
 * @supportVersion  ios: 2.11.0 android: 2.11.0
 */
export declare function stepCount$(params: IDeviceHealthStepCountParams): Promise<IDeviceHealthStepCountResult>;
export default stepCount$;

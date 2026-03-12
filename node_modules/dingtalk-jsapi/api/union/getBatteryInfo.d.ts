import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取设备电量 请求参数定义
 * @apiName getBatteryInfo
 */
export interface IUnionGetBatteryInfoParams extends ICommonAPIParams {
}
/**
 * 获取设备电量 返回结果定义
 * @apiName getBatteryInfo
 */
export interface IUnionGetBatteryInfoResult {
    level: number;
    isCharging: boolean;
}
/**
 * 获取设备电量
 * @apiName getBatteryInfo
 */
export declare function getBatteryInfo$(params: IUnionGetBatteryInfoParams): Promise<IUnionGetBatteryInfoResult>;
export default getBatteryInfo$;

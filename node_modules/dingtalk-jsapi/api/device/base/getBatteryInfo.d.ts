import { ICommonAPIParams } from '../../../constant/types';
/**
 * 获取设备电量 请求参数定义
 * @apiName device.base.getBatteryInfo
 */
export interface IDeviceBaseGetBatteryInfoParams extends ICommonAPIParams {
}
/**
 * 获取设备电量 返回结果定义
 * @apiName device.base.getBatteryInfo
 */
export interface IDeviceBaseGetBatteryInfoResult {
    level: number;
    isCharging: boolean;
}
/**
 * 获取设备电量
 * @apiName device.base.getBatteryInfo
 */
export declare function getBatteryInfo$(params: IDeviceBaseGetBatteryInfoParams): Promise<IDeviceBaseGetBatteryInfoResult>;
export default getBatteryInfo$;

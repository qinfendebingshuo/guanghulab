import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取蓝牙设备所有服务 请求参数定义
 * @apiName getBLEDeviceServices
 */
export interface IUnionGetBLEDeviceServicesParams extends ICommonAPIParams {
    deviceId: string;
}
/**
 * 获取蓝牙设备所有服务 返回结果定义
 * @apiName getBLEDeviceServices
 */
export interface IUnionGetBLEDeviceServicesResult {
    services: {
        isPrimary: boolean;
        serviceId: string;
    }[];
}
/**
 * 获取蓝牙设备所有服务
 * @apiName getBLEDeviceServices
 */
export declare function getBLEDeviceServices$(params: IUnionGetBLEDeviceServicesParams): Promise<IUnionGetBLEDeviceServicesResult>;
export default getBLEDeviceServices$;

import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取蓝牙设备所有特征值 请求参数定义
 * @apiName getBLEDeviceCharacteristics
 */
export interface IUnionGetBLEDeviceCharacteristicsParams extends ICommonAPIParams {
    deviceId: string;
    serviceId: string;
}
/**
 * 获取蓝牙设备所有特征值 返回结果定义
 * @apiName getBLEDeviceCharacteristics
 */
export interface IUnionGetBLEDeviceCharacteristicsResult {
    characteristics: {
        value: string;
        serviceId: string;
        properties: {
            read: boolean;
            write: boolean;
            notify: boolean;
            indicate: boolean;
        };
        characteristicId: string;
    }[];
}
/**
 * 获取蓝牙设备所有特征值
 * @apiName getBLEDeviceCharacteristics
 */
export declare function getBLEDeviceCharacteristics$(params: IUnionGetBLEDeviceCharacteristicsParams): Promise<IUnionGetBLEDeviceCharacteristicsResult>;
export default getBLEDeviceCharacteristics$;

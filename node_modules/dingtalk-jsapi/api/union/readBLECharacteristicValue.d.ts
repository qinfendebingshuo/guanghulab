import { ICommonAPIParams } from '../../constant/types';
/**
 * 读取蓝牙设备特征值数据 请求参数定义
 * @apiName readBLECharacteristicValue
 */
export interface IUnionReadBLECharacteristicValueParams extends ICommonAPIParams {
    deviceId: string;
    serviceId: string;
    characteristicId: string;
}
/**
 * 读取蓝牙设备特征值数据 返回结果定义
 * @apiName readBLECharacteristicValue
 */
export interface IUnionReadBLECharacteristicValueResult {
    value: string;
    serviceId: string;
    characteristicId: string;
}
/**
 * 读取蓝牙设备特征值数据
 * @apiName readBLECharacteristicValue
 */
export declare function readBLECharacteristicValue$(params: IUnionReadBLECharacteristicValueParams): Promise<IUnionReadBLECharacteristicValueResult>;
export default readBLECharacteristicValue$;

import { ICommonAPIParams } from '../../constant/types';
/**
 * 向蓝牙设备特征值中写入数据 请求参数定义
 * @apiName writeBLECharacteristicValue
 */
export interface IUnionWriteBLECharacteristicValueParams extends ICommonAPIParams {
    value: string;
    deviceId: string;
    serviceId: string;
    characteristicId: string;
}
/**
 * 向蓝牙设备特征值中写入数据 返回结果定义
 * @apiName writeBLECharacteristicValue
 */
export interface IUnionWriteBLECharacteristicValueResult {
}
/**
 * 向蓝牙设备特征值中写入数据
 * @apiName writeBLECharacteristicValue
 */
export declare function writeBLECharacteristicValue$(params: IUnionWriteBLECharacteristicValueParams): Promise<IUnionWriteBLECharacteristicValueResult>;
export default writeBLECharacteristicValue$;

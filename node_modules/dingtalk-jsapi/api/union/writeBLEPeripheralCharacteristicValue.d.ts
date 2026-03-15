import { ICommonAPIParams } from '../../constant/types';
/**
 * 写入指定特征值数据 请求参数定义
 * @apiName writeBLEPeripheralCharacteristicValue
 */
export interface IUnionWriteBLEPeripheralCharacteristicValueParams extends ICommonAPIParams {
    value: string;
    needNotify: boolean;
    serviceUUID: string;
    characteristicUUID: string;
}
/**
 * 写入指定特征值数据 返回结果定义
 * @apiName writeBLEPeripheralCharacteristicValue
 */
export interface IUnionWriteBLEPeripheralCharacteristicValueResult {
}
/**
 * 写入指定特征值数据
 * @apiName writeBLEPeripheralCharacteristicValue
 */
export declare function writeBLEPeripheralCharacteristicValue$(params: IUnionWriteBLEPeripheralCharacteristicValueParams): Promise<IUnionWriteBLEPeripheralCharacteristicValueResult>;
export default writeBLEPeripheralCharacteristicValue$;

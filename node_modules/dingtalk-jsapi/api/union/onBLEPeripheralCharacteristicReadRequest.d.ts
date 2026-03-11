import { ICommonAPIParams } from '../../constant/types';
/**
 * 监听中心设备读请求 请求参数定义
 * @apiName onBLEPeripheralCharacteristicReadRequest
 */
export interface IUnionOnBLEPeripheralCharacteristicReadRequestParams extends ICommonAPIParams {
}
/**
 * 监听中心设备读请求 返回结果定义
 * @apiName onBLEPeripheralCharacteristicReadRequest
 */
export interface IUnionOnBLEPeripheralCharacteristicReadRequestResult {
    serviceUUID: string;
    characteristicUUID: string;
}
/**
 * 监听中心设备读请求
 * @apiName onBLEPeripheralCharacteristicReadRequest
 */
export declare function onBLEPeripheralCharacteristicReadRequest$(params: IUnionOnBLEPeripheralCharacteristicReadRequestParams): Promise<IUnionOnBLEPeripheralCharacteristicReadRequestResult>;
export default onBLEPeripheralCharacteristicReadRequest$;

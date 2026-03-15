import { ICommonAPIParams } from '../../constant/types';
/**
 * 监听中心设备写请求 请求参数定义
 * @apiName onBLEPeripheralCharacteristicWriteRequest
 */
export interface IUnionOnBLEPeripheralCharacteristicWriteRequestParams extends ICommonAPIParams {
}
/**
 * 监听中心设备写请求 返回结果定义
 * @apiName onBLEPeripheralCharacteristicWriteRequest
 */
export interface IUnionOnBLEPeripheralCharacteristicWriteRequestResult {
    value: string;
    serviceUUID: string;
    characteristicUUID: string;
}
/**
 * 监听中心设备写请求
 * @apiName onBLEPeripheralCharacteristicWriteRequest
 */
export declare function onBLEPeripheralCharacteristicWriteRequest$(params: IUnionOnBLEPeripheralCharacteristicWriteRequestParams): Promise<IUnionOnBLEPeripheralCharacteristicWriteRequestResult>;
export default onBLEPeripheralCharacteristicWriteRequest$;

import { ICommonAPIParams } from '../../constant/types';
/**
 * 监听外围设备蓝牙连接状态 请求参数定义
 * @apiName onBLEPeripheralConnectionStateChanged
 */
export interface IUnionOnBLEPeripheralConnectionStateChangedParams extends ICommonAPIParams {
}
/**
 * 监听外围设备蓝牙连接状态 返回结果定义
 * @apiName onBLEPeripheralConnectionStateChanged
 */
export interface IUnionOnBLEPeripheralConnectionStateChangedResult {
    deviceId: string;
    connected: boolean;
}
/**
 * 监听外围设备蓝牙连接状态
 * @apiName onBLEPeripheralConnectionStateChanged
 */
export declare function onBLEPeripheralConnectionStateChanged$(params: IUnionOnBLEPeripheralConnectionStateChangedParams): Promise<IUnionOnBLEPeripheralConnectionStateChangedResult>;
export default onBLEPeripheralConnectionStateChanged$;

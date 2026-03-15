import { ICommonAPIParams } from '../../constant/types';
/**
 * 连接低功耗蓝牙设备 请求参数定义
 * @apiName connectBLEDevice
 */
export interface IUnionConnectBLEDeviceParams extends ICommonAPIParams {
    deviceId: string;
}
/**
 * 连接低功耗蓝牙设备 返回结果定义
 * @apiName connectBLEDevice
 */
export interface IUnionConnectBLEDeviceResult {
}
/**
 * 连接低功耗蓝牙设备
 * @apiName connectBLEDevice
 */
export declare function connectBLEDevice$(params: IUnionConnectBLEDeviceParams): Promise<IUnionConnectBLEDeviceResult>;
export default connectBLEDevice$;

import { ICommonAPIParams } from '../../constant/types';
/**
 * 断开与低功耗蓝牙设备的连接 请求参数定义
 * @apiName disconnectBLEDevice
 */
export interface IUnionDisconnectBLEDeviceParams extends ICommonAPIParams {
    deviceId: string;
}
/**
 * 断开与低功耗蓝牙设备的连接 返回结果定义
 * @apiName disconnectBLEDevice
 */
export interface IUnionDisconnectBLEDeviceResult {
}
/**
 * 断开与低功耗蓝牙设备的连接
 * @apiName disconnectBLEDevice
 */
export declare function disconnectBLEDevice$(params: IUnionDisconnectBLEDeviceParams): Promise<IUnionDisconnectBLEDeviceResult>;
export default disconnectBLEDevice$;

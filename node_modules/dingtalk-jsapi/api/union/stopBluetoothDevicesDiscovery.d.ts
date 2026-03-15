import { ICommonAPIParams } from '../../constant/types';
/**
 * 停止搜寻附近的蓝牙设备 请求参数定义
 * @apiName stopBluetoothDevicesDiscovery
 */
export interface IUnionStopBluetoothDevicesDiscoveryParams extends ICommonAPIParams {
}
/**
 * 停止搜寻附近的蓝牙设备 返回结果定义
 * @apiName stopBluetoothDevicesDiscovery
 */
export interface IUnionStopBluetoothDevicesDiscoveryResult {
}
/**
 * 停止搜寻附近的蓝牙设备
 * @apiName stopBluetoothDevicesDiscovery
 */
export declare function stopBluetoothDevicesDiscovery$(params: IUnionStopBluetoothDevicesDiscoveryParams): Promise<IUnionStopBluetoothDevicesDiscoveryResult>;
export default stopBluetoothDevicesDiscovery$;

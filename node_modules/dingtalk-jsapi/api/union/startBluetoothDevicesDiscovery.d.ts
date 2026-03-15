import { ICommonAPIParams } from '../../constant/types';
/**
 * 搜寻附近蓝牙设备 请求参数定义
 * @apiName startBluetoothDevicesDiscovery
 */
export interface IUnionStartBluetoothDevicesDiscoveryParams extends ICommonAPIParams {
    interval: number;
    services: string[];
    allowDuplicatesKey: boolean;
}
/**
 * 搜寻附近蓝牙设备 返回结果定义
 * @apiName startBluetoothDevicesDiscovery
 */
export interface IUnionStartBluetoothDevicesDiscoveryResult {
}
/**
 * 搜寻附近蓝牙设备
 * @apiName startBluetoothDevicesDiscovery
 */
export declare function startBluetoothDevicesDiscovery$(params: IUnionStartBluetoothDevicesDiscoveryParams): Promise<IUnionStartBluetoothDevicesDiscoveryResult>;
export default startBluetoothDevicesDiscovery$;

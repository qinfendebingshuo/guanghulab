import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取所有已发现的蓝牙设备 请求参数定义
 * @apiName getBluetoothDevices
 */
export interface IUnionGetBluetoothDevicesParams extends ICommonAPIParams {
}
/**
 * 获取所有已发现的蓝牙设备 返回结果定义
 * @apiName getBluetoothDevices
 */
export interface IUnionGetBluetoothDevicesResult {
    devices: {
        RSSI: number;
        name: string;
        deviceId: string;
        localName: string;
        deviceName: string;
        advertisData: string;
        manufacturerData: string;
    }[];
}
/**
 * 获取所有已发现的蓝牙设备
 * @apiName getBluetoothDevices
 */
export declare function getBluetoothDevices$(params: IUnionGetBluetoothDevicesParams): Promise<IUnionGetBluetoothDevicesResult>;
export default getBluetoothDevices$;

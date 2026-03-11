/**
 * 监听新设备事件 请求参数定义
 */
export declare type IUnionOnBluetoothDeviceFoundParams = (e: IUnionOnBluetoothDeviceFoundResult) => void;
/**
 * 监听新设备事件 返回结果定义
 */
export interface IUnionOnBluetoothDeviceFoundResult {
    RSSI: number;
    name: string;
    deviceId: string;
    localName: string;
    deviceName: string;
    advertisData: string;
}
/**
 * 监听发现新设备事件
 * @apiName onBluetoothDeviceFound
 */
export declare function onBluetoothDeviceFound$(params: IUnionOnBluetoothDeviceFoundParams): void;
export default onBluetoothDeviceFound$;

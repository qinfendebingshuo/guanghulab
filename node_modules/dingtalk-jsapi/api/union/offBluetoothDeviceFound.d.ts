/**
 * 监听新设备事件 请求参数定义
 */
export declare type IUnionOffBluetoothDeviceFoundParams = (e: IUnionOffBluetoothDeviceFoundResult) => void;
/**
 * 监听新设备事件 返回结果定义
 */
export interface IUnionOffBluetoothDeviceFoundResult {
    RSSI: number;
    name: string;
    deviceId: string;
    localName: string;
    deviceName: string;
    advertisData: string;
}
/**
 * 移除发现新设备事件
 * @apiName offBluetoothDeviceFound
 */
export declare function offBluetoothDeviceFound$(params: IUnionOffBluetoothDeviceFoundParams): void;
export default offBluetoothDeviceFound$;

export declare const apiName = "device.base.enableBluetooth";
/**
 * 开启蓝牙 请求参数定义
 * @apiName device.base.enableBluetooth
 */
export interface IDeviceBaseEnableBluetoothParams {
    [key: string]: any;
}
/**
 * 开启蓝牙 返回结果定义
 * @apiName device.base.enableBluetooth
 */
export interface IDeviceBaseEnableBluetoothResult {
    [key: string]: any;
}
/**
 * 开启蓝牙
 * @apiName device.base.enableBluetooth
 * @supportVersion  ios: 3.3.0 android: 3.3.0
 */
export declare function enableBluetooth$(params: IDeviceBaseEnableBluetoothParams): Promise<IDeviceBaseEnableBluetoothResult>;
export default enableBluetooth$;

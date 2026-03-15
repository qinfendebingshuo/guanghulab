export declare const apiName = "device.base.enableBluetoothV2";
/**
 * 打开设备蓝牙开关V2，解决Android部分机型上device.base.enableBluetooth点击「拒绝」或「允许」后没有回调状态的问题 请求参数定义
 * @apiName device.base.enableBluetoothV2
 */
export interface IDeviceBaseEnableBluetoothV2Params {
}
/**
 * 打开设备蓝牙开关V2，解决Android部分机型上device.base.enableBluetooth点击「拒绝」或「允许」后没有回调状态的问题 返回结果定义
 * @apiName device.base.enableBluetoothV2
 */
export interface IDeviceBaseEnableBluetoothV2Result {
}
/**
 * 打开设备蓝牙开关V2，解决Android部分机型上device.base.enableBluetooth点击「拒绝」或「允许」后没有回调状态的问题
 * @apiName device.base.enableBluetoothV2
 * @supportVersion android: 5.1.0
 * @author android: 序望
 */
export declare function enableBluetoothV2$(params: IDeviceBaseEnableBluetoothV2Params): Promise<IDeviceBaseEnableBluetoothV2Result>;
export default enableBluetoothV2$;

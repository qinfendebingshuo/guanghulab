export declare const apiName = "device.base.scanBleDevice";
/**
 * 扫描低功耗蓝牙 请求参数定义
 * @apiName device.base.scanBleDevice
 */
export interface IDeviceBaseScanBleDeviceParams {
    [key: string]: any;
}
/**
 * 扫描低功耗蓝牙 返回结果定义
 * @apiName device.base.scanBleDevice
 */
export interface IDeviceBaseScanBleDeviceResult {
    [key: string]: any;
}
/**
 * 扫描低功耗蓝牙
 * @apiName device.base.scanBleDevice
 * @supportVersion  ios: 3.4.7 android: 3.4.7
 */
export declare function scanBleDevice$(params: IDeviceBaseScanBleDeviceParams): Promise<IDeviceBaseScanBleDeviceResult>;
export default scanBleDevice$;

export declare const apiName = "device.base.stopScanBleDevice";
/**
 * 停止扫描低功耗蓝牙 请求参数定义
 * @apiName device.base.stopScanBleDevice
 */
export interface IDeviceBaseStopScanBleDeviceParams {
    [key: string]: any;
}
/**
 * 停止扫描低功耗蓝牙 返回结果定义
 * @apiName device.base.stopScanBleDevice
 */
export interface IDeviceBaseStopScanBleDeviceResult {
    [key: string]: any;
}
/**
 * 停止扫描低功耗蓝牙
 * @apiName device.base.stopScanBleDevice
 * @supportVersion  ios: 3.4.7 android: 3.4.7
 */
export declare function stopScanBleDevice$(params: IDeviceBaseStopScanBleDeviceParams): Promise<IDeviceBaseStopScanBleDeviceResult>;
export default stopScanBleDevice$;

export declare const apiName = "device.base.disConnectBleDevice";
/**
 * 断链蓝牙设备 请求参数定义
 * @apiName device.base.disConnectBleDevice
 */
export interface IDeviceBaseDisConnectBleDeviceParams {
    [key: string]: any;
}
/**
 * 断链蓝牙设备 返回结果定义
 * @apiName device.base.disConnectBleDevice
 */
export interface IDeviceBaseDisConnectBleDeviceResult {
    [key: string]: any;
}
/**
 * 断链蓝牙设备
 * @apiName device.base.disConnectBleDevice
 * @supportVersion  ios: 3.4.7 android: 3.4.7
 */
export declare function disConnectBleDevice$(params: IDeviceBaseDisConnectBleDeviceParams): Promise<IDeviceBaseDisConnectBleDeviceResult>;
export default disConnectBleDevice$;

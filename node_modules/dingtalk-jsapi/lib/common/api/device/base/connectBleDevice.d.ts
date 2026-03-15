export declare const apiName = "device.base.connectBleDevice";
/**
 * 连接蓝牙设备 请求参数定义
 * @apiName device.base.connectBleDevice
 */
export interface IDeviceBaseConnectBleDeviceParams {
    [key: string]: any;
}
/**
 * 连接蓝牙设备 返回结果定义
 * @apiName device.base.connectBleDevice
 */
export interface IDeviceBaseConnectBleDeviceResult {
    [key: string]: any;
}
/**
 * 连接蓝牙设备
 * @apiName device.base.connectBleDevice
 * @supportVersion  ios: 3.4.7 android: 3.4.7
 */
export declare function connectBleDevice$(params: IDeviceBaseConnectBleDeviceParams): Promise<IDeviceBaseConnectBleDeviceResult>;
export default connectBleDevice$;

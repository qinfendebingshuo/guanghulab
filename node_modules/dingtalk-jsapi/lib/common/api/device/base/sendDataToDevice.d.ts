export declare const apiName = "device.base.sendDataToDevice";
/**
 * 发送蓝牙数据包 请求参数定义
 * @apiName device.base.sendDataToDevice
 */
export interface IDeviceBaseSendDataToDeviceParams {
    [key: string]: any;
}
/**
 * 发送蓝牙数据包 返回结果定义
 * @apiName device.base.sendDataToDevice
 */
export interface IDeviceBaseSendDataToDeviceResult {
    [key: string]: any;
}
/**
 * 发送蓝牙数据包
 * @apiName device.base.sendDataToDevice
 * @supportVersion  ios: 3.4.7 android: 3.4.7
 */
export declare function sendDataToDevice$(params: IDeviceBaseSendDataToDeviceParams): Promise<IDeviceBaseSendDataToDeviceResult>;
export default sendDataToDevice$;

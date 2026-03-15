export declare const apiName = "device.base.unBindDevice";
/**
 * 硬件解绑 请求参数定义
 * @apiName device.base.unBindDevice
 */
export interface IDeviceBaseUnBindDeviceParams {
    [key: string]: any;
}
/**
 * 硬件解绑 返回结果定义
 * @apiName device.base.unBindDevice
 */
export interface IDeviceBaseUnBindDeviceResult {
    [key: string]: any;
}
/**
 * 硬件解绑
 * @apiName device.base.unBindDevice
 * @supportVersion  ios: 3.3.0 android: 3.3.0
 */
export declare function unBindDevice$(params: IDeviceBaseUnBindDeviceParams): Promise<IDeviceBaseUnBindDeviceResult>;
export default unBindDevice$;

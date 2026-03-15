export declare const apiName = "device.base.startBindDevice";
/**
 * 跳转到硬件绑定页面 请求参数定义
 * @apiName device.base.startBindDevice
 */
export interface IDeviceBaseStartBindDeviceParams {
    [key: string]: any;
}
/**
 * 跳转到硬件绑定页面 返回结果定义
 * @apiName device.base.startBindDevice
 */
export interface IDeviceBaseStartBindDeviceResult {
    [key: string]: any;
}
/**
 * 跳转到硬件绑定页面
 * @apiName device.base.startBindDevice
 * @supportVersion  ios: 3.3.0 android: 3.3.0
 */
export declare function startBindDevice$(params: IDeviceBaseStartBindDeviceParams): Promise<IDeviceBaseStartBindDeviceResult>;
export default startBindDevice$;

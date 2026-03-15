export declare const apiName = "device.base.enableWifi";
/**
 * 打开WiFi开关 请求参数定义
 * @apiName device.base.enableWifi
 */
export interface IDeviceBaseEnableWifiParams {
}
/**
 * 打开WiFi开关 返回结果定义
 * @apiName device.base.enableWifi
 */
export interface IDeviceBaseEnableWifiResult {
}
/**
 * 打开WiFi开关
 * @apiName device.base.enableWifi
 * @supportVersion ios: 4.6.1 android: 4.6.1
 */
export declare function enableWifi$(params: IDeviceBaseEnableWifiParams): Promise<IDeviceBaseEnableWifiResult>;
export default enableWifi$;

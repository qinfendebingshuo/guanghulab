export declare const apiName = "device.base.getSettings";
/**
 * 获取手机设置（目前只有ios支持） 请求参数定义
 * @apiName device.base.getSettings
 */
export interface IDeviceBaseGetSettingsParams {
    [key: string]: any;
}
/**
 * 获取手机设置（目前只有ios支持） 返回结果定义
 * @apiName device.base.getSettings
 */
export interface IDeviceBaseGetSettingsResult {
    [key: string]: any;
}
/**
 * 获取手机设置（目前只有ios支持）
 * @apiName device.base.getSettings
 * @supportVersion  ios: 2.6.0 android: 2.6.0
 */
export declare function getSettings$(params: IDeviceBaseGetSettingsParams): Promise<IDeviceBaseGetSettingsResult>;
export default getSettings$;

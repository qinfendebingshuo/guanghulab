export declare const apiName = "device.geolocation.isEnabled";
/**
 * 判断系统是否为钉钉App开启定位权限 请求参数定义
 * @apiName device.geolocation.isEnabled
 */
export interface IDeviceGeolocationIsEnabledParams {
    [key: string]: any;
}
/**
 * 判断系统是否为钉钉App开启定位权限 返回结果定义
 * @apiName device.geolocation.isEnabled
 */
export interface IDeviceGeolocationIsEnabledResult {
    [key: string]: any;
}
/**
 * 判断系统是否为钉钉App开启定位权限
 * @apiName device.geolocation.isEnabled
 * @supportVersion  ios: 3.5.3 android: 3.5.3
 */
export declare function isEnabled$(params: IDeviceGeolocationIsEnabledParams): Promise<IDeviceGeolocationIsEnabledResult>;
export default isEnabled$;

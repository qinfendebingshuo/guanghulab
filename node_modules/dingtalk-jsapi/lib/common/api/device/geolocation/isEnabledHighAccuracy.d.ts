export declare const apiName = "device.geolocation.isEnabledHighAccuracy";
/**
 * 是否启用高进度Android定位模式 请求参数定义
 * @apiName device.geolocation.isEnabledHighAccuracy
 */
export interface IDeviceGeolocationIsEnabledHighAccuracyParams {
    [key: string]: any;
}
/**
 * 是否启用高进度Android定位模式 返回结果定义
 * @apiName device.geolocation.isEnabledHighAccuracy
 */
export interface IDeviceGeolocationIsEnabledHighAccuracyResult {
    [key: string]: any;
}
/**
 * 是否启用高进度Android定位模式
 * @apiName device.geolocation.isEnabledHighAccuracy
 * @supportVersion  android: 3.5.6
 */
export declare function isEnabledHighAccuracy$(params: IDeviceGeolocationIsEnabledHighAccuracyParams): Promise<IDeviceGeolocationIsEnabledHighAccuracyResult>;
export default isEnabledHighAccuracy$;

export declare const apiName = "device.geolocation.openGps";
/**
 * 打开设置，只有android有效 请求参数定义
 * @apiName device.geolocation.openGps
 */
export interface IDeviceGeolocationOpenGpsParams {
    [key: string]: any;
}
/**
 * 打开设置，只有android有效 返回结果定义
 * @apiName device.geolocation.openGps
 */
export interface IDeviceGeolocationOpenGpsResult {
    [key: string]: any;
}
/**
 * 打开设置，只有android有效
 * @apiName device.geolocation.openGps
 * @supportVersion  ios: 2.5.0 android: 2.5.0
 */
export declare function openGps$(params: IDeviceGeolocationOpenGpsParams): Promise<IDeviceGeolocationOpenGpsResult>;
export default openGps$;

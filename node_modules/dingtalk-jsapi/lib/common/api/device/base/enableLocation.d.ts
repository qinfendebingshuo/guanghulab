export declare const apiName = "device.base.enableLocation";
/**
 * 开启定位 请求参数定义
 * @apiName device.base.enableLocation
 */
export interface IDeviceBaseEnableLocationParams {
    [key: string]: any;
}
/**
 * 开启定位 返回结果定义
 * @apiName device.base.enableLocation
 */
export interface IDeviceBaseEnableLocationResult {
    [key: string]: any;
}
/**
 * 开启定位
 * @apiName device.base.enableLocation
 * @supportVersion  ios: 3.3.0 android: 3.3.0
 */
export declare function enableLocation$(params: IDeviceBaseEnableLocationParams): Promise<IDeviceBaseEnableLocationResult>;
export default enableLocation$;

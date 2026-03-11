export declare const apiName = "internal.safe.getDeviceInfo";
/**
 * 获取设备相关信息 请求参数定义
 * @apiName internal.safe.getDeviceInfo
 */
export interface IInternalSafeGetDeviceInfoParams {
    [key: string]: any;
}
/**
 * 获取设备相关信息 返回结果定义
 * @apiName internal.safe.getDeviceInfo
 */
export interface IInternalSafeGetDeviceInfoResult {
    [key: string]: any;
}
/**
 * 获取设备相关信息
 * @apiName internal.safe.getDeviceInfo
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function getDeviceInfo$(params: IInternalSafeGetDeviceInfoParams): Promise<IInternalSafeGetDeviceInfoResult>;
export default getDeviceInfo$;

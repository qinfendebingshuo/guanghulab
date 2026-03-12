export declare const apiName = "internal.alpha.addWdsDevice";
/**
 * 获取设备上网密码 请求参数定义
 * @apiName internal.alpha.addWdsDevice
 */
export interface IInternalAlphaAddWdsDeviceParams {
    [key: string]: any;
}
/**
 * 获取设备上网密码 返回结果定义
 * @apiName internal.alpha.addWdsDevice
 */
export interface IInternalAlphaAddWdsDeviceResult {
    [key: string]: any;
}
/**
 * 获取设备上网密码
 * @apiName internal.alpha.addWdsDevice
 * @supportVersion  ios: 3.5.6 android: 3.5.6
 */
export declare function addWdsDevice$(params: IInternalAlphaAddWdsDeviceParams): Promise<IInternalAlphaAddWdsDeviceResult>;
export default addWdsDevice$;

export declare const apiName = "internal.alpha.getDevicePwd";
/**
 * 获取设备上网密码 请求参数定义
 * @apiName internal.alpha.getDevicePwd
 */
export interface IInternalAlphaGetDevicePwdParams {
    [key: string]: any;
}
/**
 * 获取设备上网密码 返回结果定义
 * @apiName internal.alpha.getDevicePwd
 */
export interface IInternalAlphaGetDevicePwdResult {
    [key: string]: any;
}
/**
 * 获取设备上网密码
 * @apiName internal.alpha.getDevicePwd
 * @supportVersion  ios: 3.5.6 android: 3.5.6
 */
export declare function getDevicePwd$(params: IInternalAlphaGetDevicePwdParams): Promise<IInternalAlphaGetDevicePwdResult>;
export default getDevicePwd$;

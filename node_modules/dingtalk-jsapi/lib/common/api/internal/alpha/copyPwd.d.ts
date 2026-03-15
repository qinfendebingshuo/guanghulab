export declare const apiName = "internal.alpha.copyPwd";
/**
 * 显示自己的Alpha上网密码 请求参数定义
 * @apiName internal.alpha.copyPwd
 */
export interface IInternalAlphaCopyPwdParams {
    [key: string]: any;
}
/**
 * 显示自己的Alpha上网密码 返回结果定义
 * @apiName internal.alpha.copyPwd
 */
export interface IInternalAlphaCopyPwdResult {
    [key: string]: any;
}
/**
 * 显示自己的Alpha上网密码
 * @apiName internal.alpha.copyPwd
 * @supportVersion  ios: 4.0 android: 4.0
 */
export declare function copyPwd$(params: IInternalAlphaCopyPwdParams): Promise<IInternalAlphaCopyPwdResult>;
export default copyPwd$;

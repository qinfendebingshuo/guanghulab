export declare const apiName = "internal.auth.getActionTokenByPwd";
/**
 * 使用钉钉密码换取敏感操作token，native输入密码 请求参数定义
 * @apiName internal.auth.getActionTokenByPwd
 */
export interface IInternalAuthGetActionTokenByPwdParams {
}
/**
 * 使用钉钉密码换取敏感操作token，native输入密码 返回结果定义
 * @apiName internal.auth.getActionTokenByPwd
 */
export interface IInternalAuthGetActionTokenByPwdResult {
    token: string;
}
/**
 * 使用钉钉密码换取敏感操作token，native输入密码
 * @apiName internal.auth.getActionTokenByPwd
 * @supportVersion ios: 4.6.9 android: 4.6.9
 */
export declare function getActionTokenByPwd$(params: IInternalAuthGetActionTokenByPwdParams): Promise<IInternalAuthGetActionTokenByPwdResult>;
export default getActionTokenByPwd$;

export declare const apiName = "internal.auth.oidcPwdSetted";
/**
 * 自建专属账户，设置完密码后，回调到native，继续后续的登录流程； 请求参数定义
 * @apiName internal.auth.oidcPwdSetted
 */
export interface IInternalAuthOidcPwdSettedParams {
}
/**
 * 自建专属账户，设置完密码后，回调到native，继续后续的登录流程； 返回结果定义
 * @apiName internal.auth.oidcPwdSetted
 */
export interface IInternalAuthOidcPwdSettedResult {
}
/**
 * 自建专属账户，设置完密码后，回调到native，继续后续的登录流程；
 * @apiName internal.auth.oidcPwdSetted
 * @supportVersion ios: 6.0.11 android: 6.0.11
 * @author iOS：姚曦 Android：几米
 */
export declare function oidcPwdSetted$(params: IInternalAuthOidcPwdSettedParams): Promise<IInternalAuthOidcPwdSettedResult>;
export default oidcPwdSetted$;

export declare const apiName = "internal.auth.reLogin";
/**
 * 跳转到登录页面，支持带参数 请求参数定义
 * @apiName internal.auth.reLogin
 */
export interface IInternalAuthReLoginParams {
    /** 账户数据类 */
    accountModel?: {
        /** 手机号类型(phone) */
        accountType?: string;
        /** 账户详细数据类 */
        account?: {
            /** 区号 */
            countryCode: string;
            /** 手机号 */
            phone?: string;
        };
    };
}
/**
 * 跳转到登录页面，支持带参数 返回结果定义
 * @apiName internal.auth.reLogin
 */
export interface IInternalAuthReLoginResult {
}
/**
 * 跳转到登录页面，支持带参数
 * @apiName internal.auth.reLogin
 * @supportVersion ios: 5.1.12 android: 5.1.12
 * @author android 几米  iOS 姚曦
 */
export declare function reLogin$(params: IInternalAuthReLoginParams): Promise<IInternalAuthReLoginResult>;
export default reLogin$;

export declare const apiName = "internal.auth.identifyByOIDC";
/**
 * SSO专属账号登录 请求参数定义
 * @apiName internal.auth.identifyByOIDC
 */
export interface IInternalAuthIdentifyByOIDCParams {
    /** 三方专属账号登录Token */
    idToken: string;
}
/**
 * SSO专属账号登录 返回结果定义
 * @apiName internal.auth.identifyByOIDC
 */
export interface IInternalAuthIdentifyByOIDCResult {
    /** 0=成功；2=需要二次验证； */
    status: number;
}
/**
 * SSO专属账号登录
 * @apiName internal.auth.identifyByOIDC
 * @supportVersion ios: 5.1.33 android: 5.1.33
 * @author iOS：姚曦 Android：朴文
 */
export declare function identifyByOIDC$(params: IInternalAuthIdentifyByOIDCParams): Promise<IInternalAuthIdentifyByOIDCResult>;
export default identifyByOIDC$;

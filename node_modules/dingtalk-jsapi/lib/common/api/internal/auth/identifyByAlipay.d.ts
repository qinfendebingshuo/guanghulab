export declare const apiName = "internal.auth.identifyByAlipay";
/**
 * 通过支付宝核身 请求参数定义
 * @apiName internal.auth.identifyByAlipay
 */
export interface IInternalAuthIdentifyByAlipayParams {
    /** 手机号 例子"+86-xxxxxx" */
    mobile: string;
    /** 临时码，作为二次核身因子时必填 */
    tempCode?: string;
    /** "login | findPwd" , 目前支持登录与召回密码两种场景使用 */
    action: string;
}
/**
 * 通过支付宝核身 返回结果定义
 * @apiName internal.auth.identifyByAlipay
 */
export interface IInternalAuthIdentifyByAlipayResult {
    /** "0|2", 0标识完成身份验证，2标识需要使用其他因子再次核身 */
    status: string;
    /** 需要再次核身时必须返回，再次核身时使用 */
    tempCode: string;
}
/**
 * 通过支付宝核身
 * @apiName internal.auth.identifyByAlipay
 * @supportVersion ios: 4.6.18 android: 4.6.18
 */
export declare function identifyByAlipay$(params: IInternalAuthIdentifyByAlipayParams): Promise<IInternalAuthIdentifyByAlipayResult>;
export default identifyByAlipay$;

export declare const apiName = "biz.user.loginBySms";
/**
 * 通过短信验证码或者tmpCode进行登录 请求参数定义
 * @apiName biz.user.loginBySms
 */
export interface IBizUserLoginBySmsParams {
    /** 用户手机号 */
    mobile: string;
    /** 用户上次验证因子code */
    tmpCode: string;
    /** 用户跳转入口 */
    entrance: string;
    /** 是否抢注 */
    takeBack: boolean;
    /** 识别当前手机号的是哪个用户id */
    historyId: number;
}
/**
 * 通过短信验证码或者tmpCode进行登录 返回结果定义
 * @apiName biz.user.loginBySms
 */
export interface IBizUserLoginBySmsResult {
    /** uid */
    id: number;
}
/**
 * 通过短信验证码或者tmpCode进行登录
 * @apiName biz.user.loginBySms
 * @supportVersion ios: 4.7.24 android: 4.7.24
 * @author android：码梦, ios：晓毒
 */
export declare function loginBySms$(params: IBizUserLoginBySmsParams): Promise<IBizUserLoginBySmsResult>;
export default loginBySms$;

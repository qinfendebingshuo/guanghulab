export declare const apiName = "biz.user.loginTaobaoWithDingtalkUserToken";
/**
 * 使用钉钉usertoken登录淘宝 请求参数定义
 * @apiName biz.user.loginTaobaoWithDingtalkUserToken
 */
export interface IBizUserLoginTaobaoWithDingtalkUserTokenParams {
}
/**
 * 使用钉钉usertoken登录淘宝 返回结果定义
 * @apiName biz.user.loginTaobaoWithDingtalkUserToken
 */
export interface IBizUserLoginTaobaoWithDingtalkUserTokenResult {
}
/**
 * 使用钉钉usertoken登录淘宝
 * @apiName biz.user.loginTaobaoWithDingtalkUserToken
 * @supportVersion ios: 4.7.10 android: 4.7.10
 * @author iOS:晨燕, Android:码梦
 */
export declare function loginTaobaoWithDingtalkUserToken$(params: IBizUserLoginTaobaoWithDingtalkUserTokenParams): Promise<IBizUserLoginTaobaoWithDingtalkUserTokenResult>;
export default loginTaobaoWithDingtalkUserToken$;

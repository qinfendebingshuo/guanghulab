export declare const apiName = "biz.user.secretID";
/**
 * 获取用户登录唯一标识 请求参数定义
 * @apiName biz.user.secretID
 */
export interface IBizUserSecretIDParams {
    [key: string]: any;
}
/**
 * 获取用户登录唯一标识 返回结果定义
 * @apiName biz.user.secretID
 */
export interface IBizUserSecretIDResult {
    [key: string]: any;
}
/**
 * 获取用户登录唯一标识
 * @apiName biz.user.secretID
 * @supportVersion  ios: 2.5.2 android: 2.5.2
 */
export declare function secretID$(params: IBizUserSecretIDParams): Promise<IBizUserSecretIDResult>;
export default secretID$;

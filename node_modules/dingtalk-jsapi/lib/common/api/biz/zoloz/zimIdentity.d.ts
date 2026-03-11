export declare const apiName = "biz.zoloz.zimIdentity";
/**
 * 启动生物识别认证接口 请求参数定义
 * @apiName biz.zoloz.zimIdentity
 */
export interface IBizZolozZimIdentityParams {
    [key: string]: any;
}
/**
 * 启动生物识别认证接口 返回结果定义
 * @apiName biz.zoloz.zimIdentity
 */
export interface IBizZolozZimIdentityResult {
    [key: string]: any;
}
/**
 * 启动生物识别认证接口
 * @apiName biz.zoloz.zimIdentity
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function zimIdentity$(params: IBizZolozZimIdentityParams): Promise<IBizZolozZimIdentityResult>;
export default zimIdentity$;

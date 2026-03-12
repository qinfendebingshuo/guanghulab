export declare const apiName = "alipay.verifyidentity.verifyIdentity";
/**
 * 核身校验 请求参数定义
 * @apiName alipay.verifyidentity.verifyIdentity
 */
export interface IAlipayVerifyidentityVerifyIdentityParams {
    /** 核身流程ID */
    verifyId: any;
}
/**
 * 核身校验 返回结果定义
 * @apiName alipay.verifyidentity.verifyIdentity
 */
export interface IAlipayVerifyidentityVerifyIdentityResult {
    /** 核身流程ID */
    verifyId: any;
    /** 核身结果返回值 */
    code: any;
    /** 核身结果描述信息 */
    message: any;
    /** 核身透传的业务数据 */
    bizResponseData: any;
}
/**
 * 核身校验
 * @apiName alipay.verifyidentity.verifyIdentity
 * @supportVersion ios: 4.3.9 android: 4.3.9
 */
export declare function verifyIdentity$(params: IAlipayVerifyidentityVerifyIdentityParams): Promise<IAlipayVerifyidentityVerifyIdentityResult>;
export default verifyIdentity$;

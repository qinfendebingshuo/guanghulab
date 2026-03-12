export declare const apiName = "alipay.verifyidentity.getBioInfo";
/**
 * 获取人脸环境参数 请求参数定义
 * @apiName alipay.verifyidentity.getBioInfo
 */
export interface IAlipayVerifyidentityGetBioInfoParams {
}
/**
 * 获取人脸环境参数 返回结果定义
 * @apiName alipay.verifyidentity.getBioInfo
 */
export interface IAlipayVerifyidentityGetBioInfoResult {
    /** 人脸环境参数信息 */
    bioInfo: any;
}
/**
 * 获取人脸环境参数
 * @apiName alipay.verifyidentity.getBioInfo
 * @supportVersion ios: 4.3.9 android: 4.3.9
 */
export declare function getBioInfo$(params: IAlipayVerifyidentityGetBioInfoParams): Promise<IAlipayVerifyidentityGetBioInfoResult>;
export default getBioInfo$;

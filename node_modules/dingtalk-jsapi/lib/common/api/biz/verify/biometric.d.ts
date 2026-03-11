export declare const apiName = "biz.verify.biometric";
/**
 * 活体识别，识别后返回识别结果图片 请求参数定义
 * @apiName biz.verify.biometric
 */
export interface IBizVerifyBiometricParams {
    [key: string]: any;
}
/**
 * 活体识别，识别后返回识别结果图片 返回结果定义
 * @apiName biz.verify.biometric
 */
export interface IBizVerifyBiometricResult {
    [key: string]: any;
}
/**
 * 活体识别，识别后返回识别结果图片
 * @apiName biz.verify.biometric
 * @supportVersion  ios: 3.5.1 android: 3.5.1
 */
export declare function biometric$(params: IBizVerifyBiometricParams): Promise<IBizVerifyBiometricResult>;
export default biometric$;

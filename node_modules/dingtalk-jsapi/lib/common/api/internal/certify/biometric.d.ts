export declare const apiName = "internal.certify.biometric";
/**
 * 调用活体拍照 请求参数定义
 * @apiName internal.certify.biometric
 */
export interface IInternalCertifyBiometricParams {
    [key: string]: any;
}
/**
 * 调用活体拍照 返回结果定义
 * @apiName internal.certify.biometric
 */
export interface IInternalCertifyBiometricResult {
    [key: string]: any;
}
/**
 * 调用活体拍照
 * @apiName internal.certify.biometric
 * @supportVersion  ios: 2.12.0 android: 2.12.0
 */
export declare function biometric$(params: IInternalCertifyBiometricParams): Promise<IInternalCertifyBiometricResult>;
export default biometric$;

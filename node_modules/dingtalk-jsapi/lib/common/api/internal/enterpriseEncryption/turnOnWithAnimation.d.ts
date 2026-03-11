export declare const apiName = "internal.enterpriseEncryption.turnOnWithAnimation";
/**
 * 企业密钥开通并展示开通动画 请求参数定义
 * @apiName internal.enterpriseEncryption.turnOnWithAnimation
 */
export interface IInternalEnterpriseEncryptionTurnOnWithAnimationParams {
    [key: string]: any;
}
/**
 * 企业密钥开通并展示开通动画 返回结果定义
 * @apiName internal.enterpriseEncryption.turnOnWithAnimation
 */
export interface IInternalEnterpriseEncryptionTurnOnWithAnimationResult {
    [key: string]: any;
}
/**
 * 企业密钥开通并展示开通动画
 * @apiName internal.enterpriseEncryption.turnOnWithAnimation
 * @supportVersion  ios: 3.4.6 android: 3.4.6
 */
export declare function turnOnWithAnimation$(params: IInternalEnterpriseEncryptionTurnOnWithAnimationParams): Promise<IInternalEnterpriseEncryptionTurnOnWithAnimationResult>;
export default turnOnWithAnimation$;

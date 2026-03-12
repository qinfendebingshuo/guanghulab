export declare const apiName = "internal.enterpriseEncryption.sendMessageToMaster";
/**
 *  企业密钥说明页面通知主管理员 请求参数定义
 * @apiName internal.enterpriseEncryption.sendMessageToMaster
 */
export interface IInternalEnterpriseEncryptionSendMessageToMasterParams {
    [key: string]: any;
}
/**
 *  企业密钥说明页面通知主管理员 返回结果定义
 * @apiName internal.enterpriseEncryption.sendMessageToMaster
 */
export interface IInternalEnterpriseEncryptionSendMessageToMasterResult {
    [key: string]: any;
}
/**
 *  企业密钥说明页面通知主管理员
 * @apiName internal.enterpriseEncryption.sendMessageToMaster
 * @supportVersion  ios: 3.4.6 android: 3.4.6
 */
export declare function sendMessageToMaster$(params: IInternalEnterpriseEncryptionSendMessageToMasterParams): Promise<IInternalEnterpriseEncryptionSendMessageToMasterResult>;
export default sendMessageToMaster$;

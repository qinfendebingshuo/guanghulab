export declare const apiName = "internal.enterpriseEncryption.info";
/**
 * 企业密钥说明页面获取企业信息 请求参数定义
 * @apiName internal.enterpriseEncryption.info
 */
export interface IInternalEnterpriseEncryptionInfoParams {
    [key: string]: any;
}
/**
 * 企业密钥说明页面获取企业信息 返回结果定义
 * @apiName internal.enterpriseEncryption.info
 */
export interface IInternalEnterpriseEncryptionInfoResult {
    [key: string]: any;
}
/**
 * 企业密钥说明页面获取企业信息
 * @apiName internal.enterpriseEncryption.info
 * @supportVersion  ios: 3.4.6 android: 3.4.6
 */
export declare function info$(params: IInternalEnterpriseEncryptionInfoParams): Promise<IInternalEnterpriseEncryptionInfoResult>;
export default info$;

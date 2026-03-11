export declare const apiName = "biz.telephone.callOrgExternalContacts";
/**
 * 企业员工拨打企业外部联系人电话 请求参数定义
 * @apiName biz.telephone.callOrgExternalContacts
 */
export interface IBizTelephoneCallOrgExternalContactsParams {
    [key: string]: any;
}
/**
 * 企业员工拨打企业外部联系人电话 返回结果定义
 * @apiName biz.telephone.callOrgExternalContacts
 */
export interface IBizTelephoneCallOrgExternalContactsResult {
    [key: string]: any;
}
/**
 * 企业员工拨打企业外部联系人电话
 * @apiName biz.telephone.callOrgExternalContacts
 * @supportVersion  ios: 3.5.3 android: 3.5.3
 */
export declare function callOrgExternalContacts$(params: IBizTelephoneCallOrgExternalContactsParams): Promise<IBizTelephoneCallOrgExternalContactsResult>;
export default callOrgExternalContacts$;

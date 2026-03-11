export declare const apiName = "biz.contact.changeCustomerFollower";
/**
 * 企业通讯录选人，加入微应用权限过滤 请求参数定义
 * @apiName biz.contact.changeCustomerFollower
 */
export interface IBizContactChangeCustomerFollowerParams {
    [key: string]: any;
}
/**
 * 企业通讯录选人，加入微应用权限过滤 返回结果定义
 * @apiName biz.contact.changeCustomerFollower
 */
export interface IBizContactChangeCustomerFollowerResult {
    [key: string]: any;
}
/**
 * 企业通讯录选人，加入微应用权限过滤
 * @apiName biz.contact.changeCustomerFollower
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function changeCustomerFollower$(params: IBizContactChangeCustomerFollowerParams): Promise<IBizContactChangeCustomerFollowerResult>;
export default changeCustomerFollower$;

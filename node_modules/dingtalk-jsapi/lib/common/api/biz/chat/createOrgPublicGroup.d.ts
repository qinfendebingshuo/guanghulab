export declare const apiName = "biz.chat.createOrgPublicGroup";
/**
 * 跳转到创建群群中间页让用户创建某个企业的公开群 请求参数定义
 * @apiName biz.chat.createOrgPublicGroup
 */
export interface IBizChatCreateOrgPublicGroupParams {
    [key: string]: any;
}
/**
 * 跳转到创建群群中间页让用户创建某个企业的公开群 返回结果定义
 * @apiName biz.chat.createOrgPublicGroup
 */
export interface IBizChatCreateOrgPublicGroupResult {
    [key: string]: any;
}
/**
 * 跳转到创建群群中间页让用户创建某个企业的公开群
 * @apiName biz.chat.createOrgPublicGroup
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function createOrgPublicGroup$(params: IBizChatCreateOrgPublicGroupParams): Promise<IBizChatCreateOrgPublicGroupResult>;
export default createOrgPublicGroup$;

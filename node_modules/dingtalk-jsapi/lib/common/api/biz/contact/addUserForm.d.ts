export declare const apiName = "biz.contact.addUserForm";
/**
 * 添加联系人 请求参数定义
 * @apiName biz.contact.addUserForm
 */
export interface IBizContactAddUserFormParams {
    /** 上游业务来源 */
    origin?: number;
    /** 上游业务来源描述 */
    originMeta?: string;
    [key: string]: any;
}
/**
 * 添加联系人 返回结果定义
 * @apiName biz.contact.addUserForm
 */
export interface IBizContactAddUserFormResult {
    [key: string]: any;
}
/**
 * 添加联系人
 * @apiName biz.contact.addUserForm
 * @supportVersion  ios: 3.1 android: 3.1
 */
export declare function addUserForm$(params: IBizContactAddUserFormParams): Promise<IBizContactAddUserFormResult>;
export default addUserForm$;

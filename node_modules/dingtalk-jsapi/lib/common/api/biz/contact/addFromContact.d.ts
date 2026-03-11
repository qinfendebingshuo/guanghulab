export declare const apiName = "biz.contact.addFromContact";
/**
 * 选手机联系人 请求参数定义
 * @apiName biz.contact.addFromContact
 */
export interface IBizContactAddFromContactParams {
    [key: string]: any;
}
/**
 * 选手机联系人 返回结果定义
 * @apiName biz.contact.addFromContact
 */
export interface IBizContactAddFromContactResult {
    [key: string]: any;
}
/**
 * 选手机联系人
 * @apiName biz.contact.addFromContact
 * @supportVersion  ios: 3.0 android: 3.0
 */
export declare function addFromContact$(params: IBizContactAddFromContactParams): Promise<IBizContactAddFromContactResult>;
export default addFromContact$;

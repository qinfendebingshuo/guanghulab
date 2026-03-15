export declare const apiName = "biz.contact.getMobileContact";
/**
 * 查询手机联系人 请求参数定义
 * @apiName biz.contact.getMobileContact
 */
export interface IBizContactGetMobileContactParams {
    [key: string]: any;
}
/**
 * 查询手机联系人 返回结果定义
 * @apiName biz.contact.getMobileContact
 */
export interface IBizContactGetMobileContactResult {
    [key: string]: any;
}
/**
 * 查询手机联系人
 * @apiName biz.contact.getMobileContact
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function getMobileContact$(params: IBizContactGetMobileContactParams): Promise<IBizContactGetMobileContactResult>;
export default getMobileContact$;

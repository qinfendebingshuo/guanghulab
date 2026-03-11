export declare const apiName = "biz.contact.pickCustomer";
/**
 * 选择客户 请求参数定义
 * @apiName biz.contact.pickCustomer
 */
export interface IBizContactPickCustomerParams {
    [key: string]: any;
}
/**
 * 选择客户 返回结果定义
 * @apiName biz.contact.pickCustomer
 */
export interface IBizContactPickCustomerResult {
    [key: string]: any;
}
/**
 * 选择客户
 * @apiName biz.contact.pickCustomer
 * @supportVersion  pc: 3.0.0 ios: 2.11 android: 2.11
 */
export declare function pickCustomer$(params: IBizContactPickCustomerParams): Promise<IBizContactPickCustomerResult>;
export default pickCustomer$;

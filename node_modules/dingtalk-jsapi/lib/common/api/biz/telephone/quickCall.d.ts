export declare const apiName = "biz.telephone.quickCall";
/**
 * 快速选择发起办公电话还是普通电话(以后按需扩展) 请求参数定义
 * @apiName biz.telephone.quickCall
 */
export interface IBizTelephoneQuickCallParams {
    [key: string]: any;
}
/**
 * 快速选择发起办公电话还是普通电话(以后按需扩展) 返回结果定义
 * @apiName biz.telephone.quickCall
 */
export interface IBizTelephoneQuickCallResult {
    [key: string]: any;
}
/**
 * 快速选择发起办公电话还是普通电话(以后按需扩展)
 * @apiName biz.telephone.quickCall
 * @supportVersion  ios: 3.5.3 android: 3.5.3
 */
export declare function quickCall$(params: IBizTelephoneQuickCallParams): Promise<IBizTelephoneQuickCallResult>;
export default quickCall$;

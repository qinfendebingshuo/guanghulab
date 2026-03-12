export declare const apiName = "retail.telephone.call";
/**
 * 新增JSAPI, 在新零售场景，直接发起办公电话 请求参数定义
 * @apiName retail.telephone.call
 */
export interface IRetailTelephoneCallParams {
    [key: string]: any;
}
/**
 * 新增JSAPI, 在新零售场景，直接发起办公电话 返回结果定义
 * @apiName retail.telephone.call
 */
export interface IRetailTelephoneCallResult {
    [key: string]: any;
}
/**
 * 新增JSAPI, 在新零售场景，直接发起办公电话
 * @apiName retail.telephone.call
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function call$(params: IRetailTelephoneCallParams): Promise<IRetailTelephoneCallResult>;
export default call$;

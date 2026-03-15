export declare const apiName = "internal.util.authAlipayInvoice";
/**
 * 唤起支付宝, 获取授权auto_code 请求参数定义
 * @apiName internal.util.authAlipayInvoice
 */
export interface IInternalUtilAuthAlipayInvoiceParams {
    [key: string]: any;
}
/**
 * 唤起支付宝, 获取授权auto_code 返回结果定义
 * @apiName internal.util.authAlipayInvoice
 */
export interface IInternalUtilAuthAlipayInvoiceResult {
    [key: string]: any;
}
/**
 * 唤起支付宝, 获取授权auto_code
 * @apiName internal.util.authAlipayInvoice
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function authAlipayInvoice$(params: IInternalUtilAuthAlipayInvoiceParams): Promise<IInternalUtilAuthAlipayInvoiceResult>;
export default authAlipayInvoice$;

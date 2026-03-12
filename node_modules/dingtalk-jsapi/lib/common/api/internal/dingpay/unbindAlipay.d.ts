export declare const apiName = "internal.dingpay.unbindAlipay";
/**
 * 解绑支付宝 请求参数定义
 * @apiName internal.dingpay.unbindAlipay
 */
export interface IInternalDingpayUnbindAlipayParams {
}
/**
 * 解绑支付宝 返回结果定义
 * @apiName internal.dingpay.unbindAlipay
 */
export interface IInternalDingpayUnbindAlipayResult {
}
/**
 * 解绑支付宝
 * @apiName internal.dingpay.unbindAlipay
 * @supportVersion ios: 6.0.14 android: 6.0.14
 * @author Android：峰砺, iOS： 木锤
 */
export declare function unbindAlipay$(params: IInternalDingpayUnbindAlipayParams): Promise<IInternalDingpayUnbindAlipayResult>;
export default unbindAlipay$;

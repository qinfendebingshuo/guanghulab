export declare const apiName = "internal.dingpay.bindAlipay";
/**
 * 绑定支付宝 请求参数定义
 * @apiName internal.dingpay.bindAlipay
 */
export interface IInternalDingpayBindAlipayParams {
    /** 请和服务端约定好, 绑定支付宝所在的业务场景 */
    bizType: string;
    /** 是否显示支付宝授权协议弹框 */
    showLicense?: boolean;
}
/**
 * 绑定支付宝 返回结果定义
 * @apiName internal.dingpay.bindAlipay
 */
export interface IInternalDingpayBindAlipayResult {
}
/**
 * 绑定支付宝
 * @apiName internal.dingpay.bindAlipay
 * @supportVersion ios: 6.0.3 android: 6.0.3
 * @author Android：千凡, iOS： 济凡
 */
export declare function bindAlipay$(params: IInternalDingpayBindAlipayParams): Promise<IInternalDingpayBindAlipayResult>;
export default bindAlipay$;

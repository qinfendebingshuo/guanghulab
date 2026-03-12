export declare const apiName = "internal.requestmoney.notifyAlipayResult";
/**
 * 支付结果同步 请求参数定义
 * @apiName internal.requestmoney.notifyAlipayResult
 */
export interface IInternalRequestmoneyNotifyAlipayResultParams {
    /** 消息id */
    msgId: string;
    /** 会话id */
    cId: string;
}
/**
 * 支付结果同步 返回结果定义
 * @apiName internal.requestmoney.notifyAlipayResult
 */
export interface IInternalRequestmoneyNotifyAlipayResultResult {
    [key: string]: any;
}
/**
 * 支付结果同步
 * @apiName internal.requestmoney.notifyAlipayResult
 * @supportVersion ios: 4.5.6 android: 4.5.6
 */
export declare function notifyAlipayResult$(params: IInternalRequestmoneyNotifyAlipayResultParams): Promise<IInternalRequestmoneyNotifyAlipayResultResult>;
export default notifyAlipayResult$;

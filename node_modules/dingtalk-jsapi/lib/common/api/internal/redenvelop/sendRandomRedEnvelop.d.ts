export declare const apiName = "internal.redenvelop.sendRandomRedEnvelop";
/**
 * 发送拼手气红包 请求参数定义
 * @apiName internal.redenvelop.sendRandomRedEnvelop
 */
export interface IInternalRedenvelopSendRandomRedEnvelopParams {
    [key: string]: any;
}
/**
 * 发送拼手气红包 返回结果定义
 * @apiName internal.redenvelop.sendRandomRedEnvelop
 */
export interface IInternalRedenvelopSendRandomRedEnvelopResult {
    [key: string]: any;
}
/**
 * 发送拼手气红包
 * @apiName internal.redenvelop.sendRandomRedEnvelop
 * @supportVersion ios: 5.1.40 android: 5.1.40
 */
export declare function sendRandomRedEnvelop$(params: IInternalRedenvelopSendRandomRedEnvelopParams): Promise<IInternalRedenvelopSendRandomRedEnvelopResult>;
export default sendRandomRedEnvelop$;

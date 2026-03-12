export declare const apiName = "biz.redenvelop.sendNormalRedEnvelop";
/**
 * x 请求参数定义
 * @apiName biz.redenvelop.sendNormalRedEnvelop
 */
export interface IBizRedenvelopSendNormalRedEnvelopParams {
    /** 发送红包企业上下文 */
    corpId: string;
    /** 专享红包的接收者，staffId集合 */
    receivers: any;
    /** 默认红包附属文案 */
    cong?: string;
    extraMsg?: string;
    thirdpartId?: string;
    thirdpartSource?: string;
    /** 默认金额, 4.7.16以上支持 */
    defaultMoney?: number;
}
/**
 * x 返回结果定义
 * @apiName biz.redenvelop.sendNormalRedEnvelop
 */
export interface IBizRedenvelopSendNormalRedEnvelopResult {
    /** 1 成功 2失败 3取消 0 未知 */
    sendResult: number;
}
/**
 * x
 * @apiName biz.redenvelop.sendNormalRedEnvelop
 * @supportVersion  ios: 2.13 android: 2.13
 * @author Andriod : 朴文, IOS: 云信
 */
export declare function sendNormalRedEnvelop$(params: IBizRedenvelopSendNormalRedEnvelopParams): Promise<IBizRedenvelopSendNormalRedEnvelopResult>;
export default sendNormalRedEnvelop$;

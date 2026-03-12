export declare const apiName = "biz.redenvelop.sendEnterpriseRedEnvelop";
/**
 * x 请求参数定义
 * @apiName biz.redenvelop.sendEnterpriseRedEnvelop
 */
export interface IBizRedenvelopSendEnterpriseRedEnvelopParams {
    [key: string]: any;
}
/**
 * x 返回结果定义
 * @apiName biz.redenvelop.sendEnterpriseRedEnvelop
 */
export interface IBizRedenvelopSendEnterpriseRedEnvelopResult {
    [key: string]: any;
}
/**
 * x
 * @apiName biz.redenvelop.sendEnterpriseRedEnvelop
 * @supportVersion  ios: 2.15 android: 2.15
 */
export declare function sendEnterpriseRedEnvelop$(params: IBizRedenvelopSendEnterpriseRedEnvelopParams): Promise<IBizRedenvelopSendEnterpriseRedEnvelopResult>;
export default sendEnterpriseRedEnvelop$;

export declare const apiName = "internal.payment.requestForInAppPurchase";
/**
 * 前端用户创建iOS应用内支付的请求 请求参数定义
 * @apiName internal.payment.requestForInAppPurchase
 */
export interface IInternalPaymentRequestForInAppPurchaseParams {
    /** 商品id，对应录入苹果 itunesconnect 后台的商品 id */
    productId: string;
    /** 数量，默认为1 */
    quantity?: number;
    /** 购买主体的类型 1:组织购买，objId为corpId 2:个人购买，objId为uid 默认值是2，个人购买 详见https://yuque.antfin-inc.com/docs/share/c0147cfc-3292-4c16-9cc4-264a413d50bf?# */
    objType?: number;
    /** 购买主体id 个人则是uid，组织则是corpId。 注意：购买主体不一定是登录人，端上可在发起支付的时候，存储该字段 详见 https://yuque.antfin-inc.com/docs/share/c0147cfc-3292-4c16-9cc4-264a413d50bf?# */
    objId?: string;
}
/**
 * 前端用户创建iOS应用内支付的请求 返回结果定义
 * @apiName internal.payment.requestForInAppPurchase
 */
export interface IInternalPaymentRequestForInAppPurchaseResult {
    [key: string]: any;
}
/**
 * 前端用户创建iOS应用内支付的请求
 * @apiName internal.payment.requestForInAppPurchase
 * @supportVersion ios: 5.1.9 android: 5.1.9
 * @author iOS: 库珀
 */
export declare function requestForInAppPurchase$(params: IInternalPaymentRequestForInAppPurchaseParams): Promise<IInternalPaymentRequestForInAppPurchaseResult>;
export default requestForInAppPurchase$;

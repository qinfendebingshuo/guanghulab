export declare const apiName = "internal.groupbill.send";
/**
 * 发送群收款 请求参数定义
 * @apiName internal.groupbill.send
 */
export interface IInternalGroupbillSendParams {
    /** 开放cid（群插件打开链接参数中获取） */
    openConversationId: string;
    /** 订单号 */
    orderNo: string;
    /** 0：平摊费用，1：按每人应付金额 */
    distributeType?: number;
    /** 总金额  */
    totalAmount: string;
    /** [{"unionId":"xxx", "amount":"xxx"}, {xxx}] 全部（如果有自己，则包含自己） */
    detail: any;
    /** 总人数 */
    totalCount?: number;
}
/**
 * 发送群收款 返回结果定义
 * @apiName internal.groupbill.send
 */
export interface IInternalGroupbillSendResult {
}
/**
 * 发送群收款
 * @apiName internal.groupbill.send
 * @supportVersion ios: 5.1.6 android: 5.1.6
 * @author Android：峰砺 iOS：木锤
 */
export declare function send$(params: IInternalGroupbillSendParams): Promise<IInternalGroupbillSendResult>;
export default send$;

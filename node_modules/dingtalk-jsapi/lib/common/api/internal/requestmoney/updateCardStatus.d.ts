export declare const apiName = "internal.requestmoney.updateCardStatus";
/**
 * 更新群收款气泡卡片状态，如已收齐、已支付、已过期…… 请求参数定义
 * @apiName internal.requestmoney.updateCardStatus
 */
export interface IInternalRequestmoneyUpdateCardStatusParams {
    ext: {
        group_bill_paid_count: any;
        group_bill_paystatus: any;
        group_bill_status: any;
    };
    /** 字符串，加密后的消息id */
    mid: string;
    /** 字符串，加密后的会话id */
    cid: string;
}
/**
 * 更新群收款气泡卡片状态，如已收齐、已支付、已过期…… 返回结果定义
 * @apiName internal.requestmoney.updateCardStatus
 */
export interface IInternalRequestmoneyUpdateCardStatusResult {
    [key: string]: any;
}
/**
 * 更新群收款气泡卡片状态，如已收齐、已支付、已过期……
 * @apiName internal.requestmoney.updateCardStatus
 * @supportVersion ios: 4.5.19 android: 4.5.19
 */
export declare function updateCardStatus$(params: IInternalRequestmoneyUpdateCardStatusParams): Promise<IInternalRequestmoneyUpdateCardStatusResult>;
export default updateCardStatus$;

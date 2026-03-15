export declare const apiName = "internal.blebusiness.showNotifyDingCard";
/**
 * 弹出DING卡提示框 请求参数定义
 * @apiName internal.blebusiness.showNotifyDingCard
 */
export interface IInternalBlebusinessShowNotifyDingCardParams {
    orgId: number;
    /** 企业LOGO的mediaId */
    logoMediaId?: string;
}
/**
 * 弹出DING卡提示框 返回结果定义
 * @apiName internal.blebusiness.showNotifyDingCard
 */
export interface IInternalBlebusinessShowNotifyDingCardResult {
    [key: string]: any;
}
/**
 * 弹出DING卡提示框
 * @apiName internal.blebusiness.showNotifyDingCard
 * @supportVersion ios: 4.6.18
 */
export declare function showNotifyDingCard$(params: IInternalBlebusinessShowNotifyDingCardParams): Promise<IInternalBlebusinessShowNotifyDingCardResult>;
export default showNotifyDingCard$;

export declare const apiName = "internal.dingCard.unbindWorkMobile";
/**
 * 解绑工作号 请求参数定义
 * @apiName internal.dingCard.unbindWorkMobile
 */
export interface IInternalDingCardUnbindWorkMobileParams {
    [key: string]: any;
}
/**
 * 解绑工作号 返回结果定义
 * @apiName internal.dingCard.unbindWorkMobile
 */
export interface IInternalDingCardUnbindWorkMobileResult {
    [key: string]: any;
}
/**
 * 解绑工作号
 * @apiName internal.dingCard.unbindWorkMobile
 * @supportVersion  ios: 3.4.10 android: 3.4.10
 */
export declare function unbindWorkMobile$(params: IInternalDingCardUnbindWorkMobileParams): Promise<IInternalDingCardUnbindWorkMobileResult>;
export default unbindWorkMobile$;

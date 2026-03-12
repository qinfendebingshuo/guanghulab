export declare const apiName = "internal.dingCard.bindWorkMobile";
/**
 * 绑定工作号 请求参数定义
 * @apiName internal.dingCard.bindWorkMobile
 */
export interface IInternalDingCardBindWorkMobileParams {
    [key: string]: any;
}
/**
 * 绑定工作号 返回结果定义
 * @apiName internal.dingCard.bindWorkMobile
 */
export interface IInternalDingCardBindWorkMobileResult {
    [key: string]: any;
}
/**
 * 绑定工作号
 * @apiName internal.dingCard.bindWorkMobile
 * @supportVersion  ios: 3.4.10 android: 3.4.10
 */
export declare function bindWorkMobile$(params: IInternalDingCardBindWorkMobileParams): Promise<IInternalDingCardBindWorkMobileResult>;
export default bindWorkMobile$;

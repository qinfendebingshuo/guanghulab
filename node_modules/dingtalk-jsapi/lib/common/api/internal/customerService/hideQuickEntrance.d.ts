export declare const apiName = "internal.customerService.hideQuickEntrance";
/**
 * 隐藏首页顶部的快速入口 请求参数定义
 * @apiName internal.customerService.hideQuickEntrance
 */
export interface IInternalCustomerServiceHideQuickEntranceParams {
}
/**
 * 隐藏首页顶部的快速入口 返回结果定义
 * @apiName internal.customerService.hideQuickEntrance
 */
export interface IInternalCustomerServiceHideQuickEntranceResult {
}
/**
 * 隐藏首页顶部的快速入口
 * @apiName internal.customerService.hideQuickEntrance
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function hideQuickEntrance$(params: IInternalCustomerServiceHideQuickEntranceParams): Promise<IInternalCustomerServiceHideQuickEntranceResult>;
export default hideQuickEntrance$;

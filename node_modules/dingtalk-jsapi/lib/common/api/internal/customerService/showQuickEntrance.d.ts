export declare const apiName = "internal.customerService.showQuickEntrance";
/**
 * 在首页顶部展示快速入口 请求参数定义
 * @apiName internal.customerService.showQuickEntrance
 */
export interface IInternalCustomerServiceShowQuickEntranceParams {
    /** 快速入口标题 */
    title: string;
    /** 快速入口左侧 icon 的 mediaId，不传显示默认 */
    icon?: string;
    /** 快速入口的点击地址，支持统一跳转协议 */
    url: string;
}
/**
 * 在首页顶部展示快速入口 返回结果定义
 * @apiName internal.customerService.showQuickEntrance
 */
export interface IInternalCustomerServiceShowQuickEntranceResult {
}
/**
 * 在首页顶部展示快速入口
 * @apiName internal.customerService.showQuickEntrance
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function showQuickEntrance$(params: IInternalCustomerServiceShowQuickEntranceParams): Promise<IInternalCustomerServiceShowQuickEntranceResult>;
export default showQuickEntrance$;

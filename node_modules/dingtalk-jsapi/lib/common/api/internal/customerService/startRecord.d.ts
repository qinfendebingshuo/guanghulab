export declare const apiName = "internal.customerService.startRecord";
/**
 * 主要给企业服务部署订单使用 请求参数定义
 * @apiName internal.customerService.startRecord
 */
export interface IInternalCustomerServiceStartRecordParams {
    /** 订单ID */
    orderId: string;
    /** 页面 url */
    url: string;
}
/**
 * 主要给企业服务部署订单使用 返回结果定义
 * @apiName internal.customerService.startRecord
 */
export interface IInternalCustomerServiceStartRecordResult {
}
/**
 * 主要给企业服务部署订单使用
 * @apiName internal.customerService.startRecord
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function startRecord$(params: IInternalCustomerServiceStartRecordParams): Promise<IInternalCustomerServiceStartRecordResult>;
export default startRecord$;

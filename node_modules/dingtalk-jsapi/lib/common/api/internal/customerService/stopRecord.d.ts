export declare const apiName = "internal.customerService.stopRecord";
/**
 * app录音,主要给企业服务部署订单使用 请求参数定义
 * @apiName internal.customerService.stopRecord
 */
export interface IInternalCustomerServiceStopRecordParams {
}
/**
 * app录音,主要给企业服务部署订单使用 返回结果定义
 * @apiName internal.customerService.stopRecord
 */
export interface IInternalCustomerServiceStopRecordResult {
}
/**
 * app录音,主要给企业服务部署订单使用
 * @apiName internal.customerService.stopRecord
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function stopRecord$(params: IInternalCustomerServiceStopRecordParams): Promise<IInternalCustomerServiceStopRecordResult>;
export default stopRecord$;

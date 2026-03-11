export declare const apiName = "internal.customerService.tryUploadRecords";
/**
 * 部署专家完成服务，录音全部结束，尝试上传录音文件 请求参数定义
 * @apiName internal.customerService.tryUploadRecords
 */
export interface IInternalCustomerServiceTryUploadRecordsParams {
    /** 订单ID； */
    orderId: string;
    /** 是否强制上传 */
    force: boolean;
}
/**
 * 部署专家完成服务，录音全部结束，尝试上传录音文件 返回结果定义
 * @apiName internal.customerService.tryUploadRecords
 */
export interface IInternalCustomerServiceTryUploadRecordsResult {
    [key: string]: any;
}
/**
 * 部署专家完成服务，录音全部结束，尝试上传录音文件
 * @apiName internal.customerService.tryUploadRecords
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function tryUploadRecords$(params: IInternalCustomerServiceTryUploadRecordsParams): Promise<IInternalCustomerServiceTryUploadRecordsResult>;
export default tryUploadRecords$;

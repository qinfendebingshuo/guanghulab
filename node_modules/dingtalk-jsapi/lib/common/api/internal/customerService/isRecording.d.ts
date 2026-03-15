export declare const apiName = "internal.customerService.isRecording";
/**
 * 检查当前是否在录音 请求参数定义
 * @apiName internal.customerService.isRecording
 */
export interface IInternalCustomerServiceIsRecordingParams {
    orderID?: string;
}
/**
 * 检查当前是否在录音 返回结果定义
 * @apiName internal.customerService.isRecording
 */
export interface IInternalCustomerServiceIsRecordingResult {
    isRecording: boolean;
}
/**
 * 检查当前是否在录音
 * @apiName internal.customerService.isRecording
 * @supportVersion ios: 4.3.9 android: 4.3.9
 */
export declare function isRecording$(params: IInternalCustomerServiceIsRecordingParams): Promise<IInternalCustomerServiceIsRecordingResult>;
export default isRecording$;

export declare const apiName = "internal.host.cancel";
/**
 * 取消离线托管任务 请求参数定义
 * @apiName internal.host.cancel
 */
export interface IInternalHostCancelParams {
    [key: string]: any;
}
/**
 * 取消离线托管任务 返回结果定义
 * @apiName internal.host.cancel
 */
export interface IInternalHostCancelResult {
    [key: string]: any;
}
/**
 * 取消离线托管任务
 * @apiName internal.host.cancel
 * @supportVersion  ios: 2.9.0 android: 2.9.0
 */
export declare function cancel$(params: IInternalHostCancelParams): Promise<IInternalHostCancelResult>;
export default cancel$;

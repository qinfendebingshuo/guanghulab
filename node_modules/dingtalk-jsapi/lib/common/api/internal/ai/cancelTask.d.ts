export declare const apiName = "internal.ai.cancelTask";
/**
 * 取消任务 请求参数定义
 * @apiName internal.ai.cancelTask
 */
export interface IInternalAiCancelTaskParams {
    [key: string]: any;
}
/**
 * 取消任务 返回结果定义
 * @apiName internal.ai.cancelTask
 */
export interface IInternalAiCancelTaskResult {
    [key: string]: any;
}
/**
 * 取消任务
 * @apiName internal.ai.cancelTask
 * @supportVersion ios: 5.1.12 android: 5.1.12
 */
export declare function cancelTask$(params: IInternalAiCancelTaskParams): Promise<IInternalAiCancelTaskResult>;
export default cancelTask$;

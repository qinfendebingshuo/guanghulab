export declare const apiName = "internal.ai.createTask";
/**
 * 创建 AI 任务 请求参数定义
 * @apiName internal.ai.createTask
 */
export interface IInternalAiCreateTaskParams {
    [key: string]: any;
}
/**
 * 创建 AI 任务 返回结果定义
 * @apiName internal.ai.createTask
 */
export interface IInternalAiCreateTaskResult {
    [key: string]: any;
}
/**
 * 创建 AI 任务
 * @apiName internal.ai.createTask
 * @supportVersion ios: 5.1.12 android: 5.1.12
 */
export declare function createTask$(params: IInternalAiCreateTaskParams): Promise<IInternalAiCreateTaskResult>;
export default createTask$;

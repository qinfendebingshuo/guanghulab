export declare const apiName = "internal.health.getTodaysStep";
/**
 * 获取步数 同步本地和华为数据对比 获取步数 请求参数定义
 * @apiName internal.health.getTodaysStep
 */
export interface IInternalHealthGetTodaysStepParams {
}
/**
 * 获取步数 同步本地和华为数据对比 获取步数 返回结果定义
 * @apiName internal.health.getTodaysStep
 */
export interface IInternalHealthGetTodaysStepResult {
    support: boolean;
    stepCount: number;
    lastUploadCount: number;
    lastUploadTime: number;
    countingStarted: boolean;
    sensorinitialized: boolean;
    uploadInterval: number;
    saveInterval: number;
    lastStepsInvalid: boolean;
}
/**
 * 获取步数 同步本地和华为数据对比 获取步数
 * @apiName internal.health.getTodaysStep
 * @supportVersion android: 4.7.27
 * @author android: 南洲
 */
export declare function getTodaysStep$(params: IInternalHealthGetTodaysStepParams): Promise<IInternalHealthGetTodaysStepResult>;
export default getTodaysStep$;

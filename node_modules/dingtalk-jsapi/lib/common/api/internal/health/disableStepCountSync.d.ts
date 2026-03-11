export declare const apiName = "internal.health.disableStepCountSync";
/**
 * 关闭 步数同步功能 请求参数定义
 * @apiName internal.health.disableStepCountSync
 */
export interface IInternalHealthDisableStepCountSyncParams {
    [key: string]: any;
}
/**
 * 关闭 步数同步功能 返回结果定义
 * @apiName internal.health.disableStepCountSync
 */
export interface IInternalHealthDisableStepCountSyncResult {
    [key: string]: any;
}
/**
 * 关闭 步数同步功能
 * @apiName internal.health.disableStepCountSync
 * @supportVersion  ios: 3.4.1 android: 3.4.1
 */
export declare function disableStepCountSync$(params: IInternalHealthDisableStepCountSyncParams): Promise<IInternalHealthDisableStepCountSyncResult>;
export default disableStepCountSync$;

export declare const apiName = "internal.health.enableStepCountSync";
/**
 * 开启步数同步功能（步数：用户当天0：00至当前时间的总步数），并立即上传一次 请求参数定义
 * @apiName internal.health.enableStepCountSync
 */
export interface IInternalHealthEnableStepCountSyncParams {
    [key: string]: any;
}
/**
 * 开启步数同步功能（步数：用户当天0：00至当前时间的总步数），并立即上传一次 返回结果定义
 * @apiName internal.health.enableStepCountSync
 */
export interface IInternalHealthEnableStepCountSyncResult {
    [key: string]: any;
}
/**
 * 开启步数同步功能（步数：用户当天0：00至当前时间的总步数），并立即上传一次
 * @apiName internal.health.enableStepCountSync
 * @supportVersion  ios: 3.4.1 android: 3.4.1
 */
export declare function enableStepCountSync$(params: IInternalHealthEnableStepCountSyncParams): Promise<IInternalHealthEnableStepCountSyncResult>;
export default enableStepCountSync$;

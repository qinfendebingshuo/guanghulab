export declare const apiName = "biz.sports.enableStepCountSync";
/**
 * 钉钉运动开启上传步数 请求参数定义
 * @apiName biz.sports.enableStepCountSync
 */
export interface IBizSportsEnableStepCountSyncParams {
}
/**
 * 钉钉运动开启上传步数 返回结果定义
 * @apiName biz.sports.enableStepCountSync
 */
export interface IBizSportsEnableStepCountSyncResult {
}
/**
 * 钉钉运动开启上传步数
 * @apiName biz.sports.enableStepCountSync
 * @supportVersion ios: 4.5.21 android: 4.5.21
 */
export declare function enableStepCountSync$(params: IBizSportsEnableStepCountSyncParams): Promise<IBizSportsEnableStepCountSyncResult>;
export default enableStepCountSync$;

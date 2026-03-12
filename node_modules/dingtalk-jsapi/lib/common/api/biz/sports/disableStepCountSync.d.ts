export declare const apiName = "biz.sports.disableStepCountSync";
/**
 * 钉钉运动停止上传步数 请求参数定义
 * @apiName biz.sports.disableStepCountSync
 */
export interface IBizSportsDisableStepCountSyncParams {
}
/**
 * 钉钉运动停止上传步数 返回结果定义
 * @apiName biz.sports.disableStepCountSync
 */
export interface IBizSportsDisableStepCountSyncResult {
}
/**
 * 钉钉运动停止上传步数
 * @apiName biz.sports.disableStepCountSync
 * @supportVersion ios: 4.5.21 android: 4.5.21
 */
export declare function disableStepCountSync$(params: IBizSportsDisableStepCountSyncParams): Promise<IBizSportsDisableStepCountSyncResult>;
export default disableStepCountSync$;

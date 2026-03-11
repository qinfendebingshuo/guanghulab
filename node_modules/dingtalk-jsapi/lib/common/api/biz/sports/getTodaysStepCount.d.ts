export declare const apiName = "biz.sports.getTodaysStepCount";
/**
 * 钉钉运动，后去当天行走步数 请求参数定义
 * @apiName biz.sports.getTodaysStepCount
 */
export interface IBizSportsGetTodaysStepCountParams {
}
/**
 * 钉钉运动，后去当天行走步数 返回结果定义
 * @apiName biz.sports.getTodaysStepCount
 */
export interface IBizSportsGetTodaysStepCountResult {
    /** 系统是否支持计步 */
    support: boolean;
    /** 当前步数总数 */
    stepCount: number;
    /** 最后一次上传的步数 */
    lastUploadCount: number;
    /** 最后一次上传的时间 */
    lastUploadTime: number;
    /** 是否已经开始计步 */
    countingStarted: boolean;
    /** 注册系统计步传感器是否成功 */
    sensorInitialized: boolean;
    /** 步数上传周期（毫秒） */
    uploadInterval: number;
    /** 本地步数保存周期（毫秒） */
    saveInterval: number;
    /** 最后一次步数记录是否是非法数据 */
    lastStepsInvalid: boolean;
}
/**
 * 钉钉运动，后去当天行走步数
 * @apiName biz.sports.getTodaysStepCount
 * @supportVersion ios: 4.5.21 android: 4.5.21
 */
export declare function getTodaysStepCount$(params: IBizSportsGetTodaysStepCountParams): Promise<IBizSportsGetTodaysStepCountResult>;
export default getTodaysStepCount$;

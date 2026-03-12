export declare const apiName = "internal.schedule.update";
/**
 * 打开日程编辑窗口 请求参数定义
 * @apiName internal.schedule.update
 */
export interface IInternalScheduleUpdateParams {
    /** 日程目录id */
    folderId: string;
    /** 日程唯一id */
    uniqueId: string;
}
/**
 * 打开日程编辑窗口 返回结果定义
 * @apiName internal.schedule.update
 */
export interface IInternalScheduleUpdateResult {
}
/**
 * 打开日程编辑窗口
 * @apiName internal.schedule.update
 * @supportVersion ios: 4.7.8 android: 4.7.8
 */
export declare function update$(params: IInternalScheduleUpdateParams): Promise<IInternalScheduleUpdateResult>;
export default update$;

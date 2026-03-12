export declare const apiName = "internal.attend.getOfflineResource";
/**
 * 获取考勤离线数据 请求参数定义
 * @apiName internal.attend.getOfflineResource
 */
export interface IInternalAttendGetOfflineResourceParams {
    corpId: string;
}
/**
 * 获取考勤离线数据 返回结果定义
 * @apiName internal.attend.getOfflineResource
 */
export interface IInternalAttendGetOfflineResourceResult {
    /** 考勤首页离线数据所包含的所有信息的 JSON */
    atCheckModel: string;
}
/**
 * 获取考勤离线数据
 * @apiName internal.attend.getOfflineResource
 * @supportVersion ios: 4.7.13 android: 4.7.13
 * @author android:序望
 */
export declare function getOfflineResource$(params: IInternalAttendGetOfflineResourceParams): Promise<IInternalAttendGetOfflineResourceResult>;
export default getOfflineResource$;

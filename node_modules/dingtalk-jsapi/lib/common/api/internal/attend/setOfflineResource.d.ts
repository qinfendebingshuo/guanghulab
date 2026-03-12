export declare const apiName = "internal.attend.setOfflineResource";
/**
 * 考勤离线数据设置，当获取的考勤离线数据过期时调用，用于更新数据 请求参数定义
 * @apiName internal.attend.setOfflineResource
 */
export interface IInternalAttendSetOfflineResourceParams {
    /** 考勤数据设置，Json格式 */
    atCheckModel: string;
}
/**
 * 考勤离线数据设置，当获取的考勤离线数据过期时调用，用于更新数据 返回结果定义
 * @apiName internal.attend.setOfflineResource
 */
export interface IInternalAttendSetOfflineResourceResult {
    [key: string]: any;
}
/**
 * 考勤离线数据设置，当获取的考勤离线数据过期时调用，用于更新数据
 * @apiName internal.attend.setOfflineResource
 * @supportVersion ios: 4.7.13 android: 4.7.13
 * @author Android:序望
 */
export declare function setOfflineResource$(params: IInternalAttendSetOfflineResourceParams): Promise<IInternalAttendSetOfflineResourceResult>;
export default setOfflineResource$;

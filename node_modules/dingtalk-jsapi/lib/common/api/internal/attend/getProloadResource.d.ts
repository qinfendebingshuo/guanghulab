export declare const apiName = "internal.attend.getProloadResource";
/**
 * 获取考勤预加载资源 请求参数定义
 * @apiName internal.attend.getProloadResource
 */
export interface IInternalAttendGetProloadResourceParams {
    /** 设置是否允许预加载 */
    enablePreload: boolean;
    /** 设置预加载时lwp接口 */
    lwpAccess: string;
}
/**
 * 获取考勤预加载资源 返回结果定义
 * @apiName internal.attend.getProloadResource
 */
export interface IInternalAttendGetProloadResourceResult {
}
/**
 * 获取考勤预加载资源
 * @apiName internal.attend.getProloadResource
 * @supportVersion android: 4.7.9
 * @author android:序望
 */
export declare function getProloadResource$(params: IInternalAttendGetProloadResourceParams): Promise<IInternalAttendGetProloadResourceResult>;
export default getProloadResource$;

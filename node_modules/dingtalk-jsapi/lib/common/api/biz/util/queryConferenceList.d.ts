export declare const apiName = "biz.util.queryConferenceList";
/**
 * 查询会议列表 请求参数定义
 * @apiName biz.util.queryConferenceList
 */
export interface IBizUtilQueryConferenceListParams {
    [key: string]: any;
}
/**
 * 查询会议列表 返回结果定义
 * @apiName biz.util.queryConferenceList
 */
export interface IBizUtilQueryConferenceListResult {
    [key: string]: any;
}
/**
 * 查询会议列表
 * @apiName biz.util.queryConferenceList
 * @supportVersion  pc: 3.0.0
 */
export declare function queryConferenceList$(params: IBizUtilQueryConferenceListParams): Promise<IBizUtilQueryConferenceListResult>;
export default queryConferenceList$;

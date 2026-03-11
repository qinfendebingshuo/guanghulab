export declare const apiName = "biz.live.listLiveRecords";
/**
 * 获取录播列表 请求参数定义
 * @apiName biz.live.listLiveRecords
 */
export interface IBizLiveListLiveRecordsParams {
    [key: string]: any;
}
/**
 * 获取录播列表 返回结果定义
 * @apiName biz.live.listLiveRecords
 */
export interface IBizLiveListLiveRecordsResult {
    [key: string]: any;
}
/**
 * 获取录播列表
 * @apiName biz.live.listLiveRecords
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function listLiveRecords$(params: IBizLiveListLiveRecordsParams): Promise<IBizLiveListLiveRecordsResult>;
export default listLiveRecords$;

export declare const apiName = "biz.live.listLiveViewers";
/**
 * 获取观众列表 请求参数定义
 * @apiName biz.live.listLiveViewers
 */
export interface IBizLiveListLiveViewersParams {
    [key: string]: any;
}
/**
 * 获取观众列表 返回结果定义
 * @apiName biz.live.listLiveViewers
 */
export interface IBizLiveListLiveViewersResult {
    [key: string]: any;
}
/**
 * 获取观众列表
 * @apiName biz.live.listLiveViewers
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function listLiveViewers$(params: IBizLiveListLiveViewersParams): Promise<IBizLiveListLiveViewersResult>;
export default listLiveViewers$;

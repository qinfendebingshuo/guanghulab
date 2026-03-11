export declare const apiName = "biz.live.nav2GroupAnchorList";
/**
 * 跳转群主播列表页面 请求参数定义
 * @apiName biz.live.nav2GroupAnchorList
 */
export interface IBizLiveNav2GroupAnchorListParams {
    [key: string]: any;
}
/**
 * 跳转群主播列表页面 返回结果定义
 * @apiName biz.live.nav2GroupAnchorList
 */
export interface IBizLiveNav2GroupAnchorListResult {
    [key: string]: any;
}
/**
 * 跳转群主播列表页面
 * @apiName biz.live.nav2GroupAnchorList
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function nav2GroupAnchorList$(params: IBizLiveNav2GroupAnchorListParams): Promise<IBizLiveNav2GroupAnchorListResult>;
export default nav2GroupAnchorList$;

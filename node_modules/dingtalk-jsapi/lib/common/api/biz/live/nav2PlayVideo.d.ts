export declare const apiName = "biz.live.nav2PlayVideo";
/**
 * 跳转至播放页面 请求参数定义
 * @apiName biz.live.nav2PlayVideo
 */
export interface IBizLiveNav2PlayVideoParams {
    [key: string]: any;
}
/**
 * 跳转至播放页面 返回结果定义
 * @apiName biz.live.nav2PlayVideo
 */
export interface IBizLiveNav2PlayVideoResult {
    [key: string]: any;
}
/**
 * 跳转至播放页面
 * @apiName biz.live.nav2PlayVideo
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function nav2PlayVideo$(params: IBizLiveNav2PlayVideoParams): Promise<IBizLiveNav2PlayVideoResult>;
export default nav2PlayVideo$;

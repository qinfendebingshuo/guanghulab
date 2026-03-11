export declare const apiName = "biz.preload.video";
/**
 * 视频预加载功能，提前下载部分视频头部文件 请求参数定义
 * @apiName biz.preload.video
 */
export interface IBizPreloadVideoParams {
    /** 需要预加载的资源，支持url，不支持hls(m3u8) */
    src: string;
    /** 仅Android支持，每个视频缓存大小 1048576（1M） <= cacheSize <= 10485760（10M） */
    cacheSize?: number;
    /** 仅Android支持，是否用H265解码 默认以H264解码 */
    H265?: boolean;
}
/**
 * 视频预加载功能，提前下载部分视频头部文件 返回结果定义
 * @apiName biz.preload.video
 */
export interface IBizPreloadVideoResult {
}
/**
 * 视频预加载功能，提前下载部分视频头部文件
 * @apiName biz.preload.video
 * @supportVersion ios: 5.1.19 android: 5.1.19
 * @author Android：零封 iOS：须莫
 */
export declare function video$(params: IBizPreloadVideoParams): Promise<IBizPreloadVideoResult>;
export default video$;

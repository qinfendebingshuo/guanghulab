export declare const apiName = "internal.biz.uploadVideo";
/**
 * 上传视频文件到cdn暂时只在pc和mac端 请求参数定义
 * @apiName internal.biz.uploadVideo
 */
export interface IInternalBizUploadVideoParams {
    [key: string]: any;
}
/**
 * 上传视频文件到cdn暂时只在pc和mac端 返回结果定义
 * @apiName internal.biz.uploadVideo
 */
export interface IInternalBizUploadVideoResult {
    [key: string]: any;
}
/**
 * 上传视频文件到cdn暂时只在pc和mac端
 * @apiName internal.biz.uploadVideo
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function uploadVideo$(params: IInternalBizUploadVideoParams): Promise<IInternalBizUploadVideoResult>;
export default uploadVideo$;

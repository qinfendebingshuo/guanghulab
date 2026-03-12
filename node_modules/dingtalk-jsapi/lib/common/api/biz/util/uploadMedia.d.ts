export declare const apiName = "biz.util.uploadMedia";
/**
 * 持在从相册选图时，可以选择视频。选择视频与选择图片互斥，且在选择视频场景，为单选 请求参数定义
 * @apiName biz.util.uploadMedia
 */
export interface IBizUtilUploadMediaParams {
    /** (>= 5.0.0) */
    bizType?: string;
    /**
     * (>= 5.0.0)
     * 1，STRICT_AUTH, 严格鉴权,下载文件时需要回调业务方进行鉴权，默认值 。
     * 4，TEMP_AUTH,  临时文件，过期后删除文件，无法访问。
     * 6，CDN_ONLY，公开文件，上传后只可以通过https下载
     */
    authType?: number;
    /** 是否多选，默认false */
    multiple?: boolean;
    /** 最多可选个数 */
    max?: number;
    /** 是否压缩 */
    compression?: boolean;
    /** Number为正整数，取值 0~100， 表示图片压缩质量，数值越小压缩越严重 */
    quality?: number;
    /** Number为正整数，取值 0~100， 表示图片压缩质量，数值越小缩放越多 */
    resize?: number;
    /** 是否在上传阶段显示上传对话框，默认true , 支持版本 >= 4.6.4 */
    showDialog?: boolean;
    /** 视频压缩质量，默认high, 支持版本 >= 4.6.4 */
    videoQuality: 'high' | 'middle' | 'low';
    /** 水印信息，钉钉v2.11.0之后版本支持 */
    stickers?: {
        time?: string;
        dateWeather?: string;
        username?: string;
        address?: string;
    };
    /** 是否callback上传进度， 默认 false */
    needProgress?: boolean;
    /** 是否需要鉴权，默认false */
    needAuth?: boolean;
    /** 上传视频大小可以配置（在上传前校验，过大给与提示）,单位 KB  */
    maxSize?: number;
    onSuccess?: (result: IBizUtilUploadMediaResult) => void;
}
/**
 * 持在从相册选图时，可以选择视频。选择视频与选择图片互斥，且在选择视频场景，为单选 返回结果定义
 * @apiName biz.util.uploadMedia
 */
export interface IBizUtilUploadMediaResult {
    medias?: Array<{
        type?: 'image' | 'video';
        mediaId?: string;
        mediaUrl?: string;
        thumbnailMediaId?: string;
        thumbnailUrl?: string;
        videoHeight?: number;
        videoWidth?: number;
        videoDuration?: number;
        videoFileSize?: number;
        videoFileName?: string;
        /** 如果传入了needAuth:true，则返回这个 */
        authMediaId?: string;
    }>;
    /** 如果needProgress=true,则callback进度, 取值 [0,100] */
    progress?: number;
}
/**
 * 持在从相册选图时，可以选择视频。选择视频与选择图片互斥，且在选择视频场景，为单选
 * @apiName biz.util.uploadMedia
 * @supportVersion ios: 4.3.5 android: 4.3.5
 * @author android：卓剑， ios：须莫
 */
export declare function uploadMedia$(params: IBizUtilUploadMediaParams): Promise<IBizUtilUploadMediaResult>;
export default uploadMedia$;

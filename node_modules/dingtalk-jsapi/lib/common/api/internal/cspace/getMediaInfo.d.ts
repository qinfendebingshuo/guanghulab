export declare const apiName = "internal.cspace.getMediaInfo";
/**
 * 获取钉盘内媒体文件信息，例如视频的封面、时长，音频的时长，图片的缩略图等 请求参数定义
 * @apiName internal.cspace.getMediaInfo
 */
export interface IInternalCspaceGetMediaInfoParams {
    /** 文件所在的钉盘Space的ID */
    spaceId: string;
    /** 文件对应的钉盘Dentry的ID */
    fileId: string;
}
/**
 * 获取钉盘内媒体文件信息，例如视频的封面、时长，音频的时长，图片的缩略图等 返回结果定义
 * @apiName internal.cspace.getMediaInfo
 */
export interface IInternalCspaceGetMediaInfoResult {
    /** 文件所在的钉盘Space的ID */
    spaceId: string;
    /** 文件对应的钉盘Dentry的ID */
    fileId: string;
    /** 缩略图的MediaId */
    thumbnailMediaId: string;
    /** 缩略图的AuthMediaId */
    thumbnailAuthMediaId: string;
    /** 缩略图的AuthCode */
    thumbnailAuthCode: string;
    /** 缩略图的宽度(像素), */
    thumbnailWidth: number;
    /** 缩略图的高度(像素) */
    thumbnailHeight: number;
    /** 缩略图的方向(顺时针旋转角度) 0, 90, 180, 270 */
    thumbnailRotation: number;
    /** 缩略图的大小(字节) */
    thumbnailDataSize: number;
    /** 时长(秒) */
    duration: number;
}
/**
 * 获取钉盘内媒体文件信息，例如视频的封面、时长，音频的时长，图片的缩略图等
 * @apiName internal.cspace.getMediaInfo
 * @supportVersion ios: 4.5.13 android: 4.5.13
 */
export declare function getMediaInfo$(params: IInternalCspaceGetMediaInfoParams): Promise<IInternalCspaceGetMediaInfoResult>;
export default getMediaInfo$;

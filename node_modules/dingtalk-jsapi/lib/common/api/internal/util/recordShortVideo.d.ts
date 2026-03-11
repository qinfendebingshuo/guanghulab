export declare const apiName = "internal.util.recordShortVideo";
/**
 * 淘拍短视频拍摄 请求参数定义
 * @apiName internal.util.recordShortVideo
 */
export interface IInternalUtilRecordShortVideoParams {
    /** 前后摄像头（0: rear 1: front），默认rear。 */
    camera?: number;
    /** 最大拍摄时长，默认60s。 */
    durationMax?: number;
    /** 最小拍摄时长，默认1s。 */
    durationMin?: number;
    /** 开启滤镜，默认False。 */
    enableFiler?: boolean;
    /** 开启道具，默认False。 */
    enableProps?: boolean;
    /** 主题特效素材ID。 */
    materialId?: string;
}
/**
 * 淘拍短视频拍摄 返回结果定义
 * @apiName internal.util.recordShortVideo
 */
export interface IInternalUtilRecordShortVideoResult {
    /** 拍摄后的视频文件信息 */
    data: {
        /** 视频文件路径：APFilePath格式返回。 */
        filePath: string;
        /** 视频时长 */
        duration: number;
        /** 视频尺寸：宽 */
        width: number;
        /** 视频尺寸：高 */
        height: number;
        /** 视频文件大小 */
        size: number;
    };
}
/**
 * 淘拍短视频拍摄
 * @apiName internal.util.recordShortVideo
 * @supportVersion ios: 4.6.37 android: 4.6.37
 */
export declare function recordShortVideo$(params: IInternalUtilRecordShortVideoParams): Promise<IInternalUtilRecordShortVideoResult>;
export default recordShortVideo$;

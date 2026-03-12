import { ICommonAPIParams } from '../../constant/types';
/**
 * 上传闪记视频 请求参数定义
 * @apiName minutesUploadVideo
 */
export interface IUnionMinutesUploadVideoParams extends ICommonAPIParams {
    type: string;
    scene: string;
    title: string;
    compress: boolean;
    maxDuration: number;
    needProgress?: boolean;
    compressLevel?: number;
}
/**
 * 上传闪记视频 返回结果定义
 * @apiName minutesUploadVideo
 */
export interface IUnionMinutesUploadVideoResult {
    videoId: string;
    progress: number;
}
/**
 * 上传闪记视频
 * @apiName minutesUploadVideo
 */
export declare function minutesUploadVideo$(params: IUnionMinutesUploadVideoParams): Promise<IUnionMinutesUploadVideoResult>;
export default minutesUploadVideo$;

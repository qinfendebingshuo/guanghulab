import { ICommonAPIParams } from '../../constant/types';
/**
 * 下载音频 请求参数定义
 * @apiName downloadAudio
 */
export interface IUnionDownloadAudioParams extends ICommonAPIParams {
    mediaId: string;
}
/**
 * 下载音频 返回结果定义
 * @apiName downloadAudio
 */
export interface IUnionDownloadAudioResult {
}
/**
 * 下载音频
 * @apiName downloadAudio
 */
export declare function downloadAudio$(params: IUnionDownloadAudioParams): Promise<IUnionDownloadAudioResult>;
export default downloadAudio$;

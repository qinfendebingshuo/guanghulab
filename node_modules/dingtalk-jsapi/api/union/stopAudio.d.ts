import { ICommonAPIParams } from '../../constant/types';
/**
 * 停止播放音频 请求参数定义
 * @apiName stopAudio
 */
export interface IUnionStopAudioParams extends ICommonAPIParams {
    localAudioId: string;
}
/**
 * 停止播放音频 返回结果定义
 * @apiName stopAudio
 */
export interface IUnionStopAudioResult {
}
/**
 * 停止播放音频
 * @apiName stopAudio
 */
export declare function stopAudio$(params: IUnionStopAudioParams): Promise<IUnionStopAudioResult>;
export default stopAudio$;

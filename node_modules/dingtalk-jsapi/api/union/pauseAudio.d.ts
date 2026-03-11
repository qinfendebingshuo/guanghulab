import { ICommonAPIParams } from '../../constant/types';
/**
 * 暂停播放语音 请求参数定义
 * @apiName pauseAudio
 */
export interface IUnionPauseAudioParams extends ICommonAPIParams {
    localAudioId: string;
}
/**
 * 暂停播放语音 返回结果定义
 * @apiName pauseAudio
 */
export interface IUnionPauseAudioResult {
}
/**
 * 暂停播放语音
 * @apiName pauseAudio
 */
export declare function pauseAudio$(params: IUnionPauseAudioParams): Promise<IUnionPauseAudioResult>;
export default pauseAudio$;

import { ICommonAPIParams } from '../../constant/types';
/**
 * 恢复暂停播放的语音 请求参数定义
 * @apiName resumeAudio
 */
export interface IUnionResumeAudioParams extends ICommonAPIParams {
    localAudioId: string;
}
/**
 * 恢复暂停播放的语音 返回结果定义
 * @apiName resumeAudio
 */
export interface IUnionResumeAudioResult {
}
/**
 * 恢复暂停播放的语音
 * @apiName resumeAudio
 */
export declare function resumeAudio$(params: IUnionResumeAudioParams): Promise<IUnionResumeAudioResult>;
export default resumeAudio$;

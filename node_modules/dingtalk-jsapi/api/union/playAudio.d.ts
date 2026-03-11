import { ICommonAPIParams } from '../../constant/types';
/**
 * 播放音频 请求参数定义
 * @apiName playAudio
 */
export interface IUnionPlayAudioParams extends ICommonAPIParams {
    localAudioId: string;
}
/**
 * 播放音频 返回结果定义
 * @apiName playAudio
 */
export interface IUnionPlayAudioResult {
}
/**
 * 播放音频
 * @apiName playAudio
 */
export declare function playAudio$(params: IUnionPlayAudioParams): Promise<IUnionPlayAudioResult>;
export default playAudio$;

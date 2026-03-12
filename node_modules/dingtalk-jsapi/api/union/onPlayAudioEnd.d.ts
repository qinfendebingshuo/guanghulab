import { ICommonAPIParams } from '../../constant/types';
/**
 * 监听播放自动停止 请求参数定义
 * @apiName onPlayAudioEnd
 */
export interface IUnionOnPlayAudioEndParams extends ICommonAPIParams {
}
/**
 * 监听播放自动停止 返回结果定义
 * @apiName onPlayAudioEnd
 */
export interface IUnionOnPlayAudioEndResult {
    localAudioId: string;
}
/**
 * 监听播放自动停止
 * @apiName onPlayAudioEnd
 */
export declare function onPlayAudioEnd$(params: IUnionOnPlayAudioEndParams): Promise<IUnionOnPlayAudioEndResult>;
export default onPlayAudioEnd$;

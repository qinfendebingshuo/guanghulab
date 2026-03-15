import { ICommonAPIParams } from '../../constant/types';
/**
 * 语音转文字 请求参数定义
 * @apiName translateVoice
 */
export interface IUnionTranslateVoiceParams extends ICommonAPIParams {
    mediaId: string;
    duration: number;
}
/**
 * 语音转文字 返回结果定义
 * @apiName translateVoice
 */
export interface IUnionTranslateVoiceResult {
}
/**
 * 语音转文字
 * @apiName translateVoice
 */
export declare function translateVoice$(params: IUnionTranslateVoiceParams): Promise<IUnionTranslateVoiceResult>;
export default translateVoice$;

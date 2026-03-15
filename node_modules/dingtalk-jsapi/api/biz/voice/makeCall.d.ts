import { ICommonAPIParams } from '../../../constant/types';
/**
 * 语音通话 请求参数定义
 * @apiName biz.voice.makeCall
 */
export interface IBizVoiceMakeCallParams extends ICommonAPIParams {
    corpId: string;
    staffId: string;
}
/**
 * 语音通话 返回结果定义
 * @apiName biz.voice.makeCall
 */
export interface IBizVoiceMakeCallResult {
}
/**
 * 语音通话
 * @apiName biz.voice.makeCall
 */
export declare function makeCall$(params: IBizVoiceMakeCallParams): Promise<IBizVoiceMakeCallResult>;
export default makeCall$;

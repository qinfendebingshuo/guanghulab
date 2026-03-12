import { ICommonAPIParams } from '../../constant/types';
/**
 * 开始录音 请求参数定义
 * @apiName startRecord
 */
export interface IUnionStartRecordParams extends ICommonAPIParams {
    maxDuration: number;
}
/**
 * 开始录音 返回结果定义
 * @apiName startRecord
 */
export interface IUnionStartRecordResult {
}
/**
 * 开始录音
 * @apiName startRecord
 */
export declare function startRecord$(params: IUnionStartRecordParams): Promise<IUnionStartRecordResult>;
export default startRecord$;

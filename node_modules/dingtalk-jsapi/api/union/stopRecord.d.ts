import { ICommonAPIParams } from '../../constant/types';
/**
 * 停止录音 请求参数定义
 * @apiName stopRecord
 */
export interface IUnionStopRecordParams extends ICommonAPIParams {
}
/**
 * 停止录音 返回结果定义
 * @apiName stopRecord
 */
export interface IUnionStopRecordResult {
}
/**
 * 停止录音
 * @apiName stopRecord
 */
export declare function stopRecord$(params: IUnionStopRecordParams): Promise<IUnionStopRecordResult>;
export default stopRecord$;

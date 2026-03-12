import { ICommonAPIParams } from '../../constant/types';
/**
 * 监听录音自动停止 请求参数定义
 * @apiName onRecordEnd
 */
export interface IUnionOnRecordEndParams extends ICommonAPIParams {
}
/**
 * 监听录音自动停止 返回结果定义
 * @apiName onRecordEnd
 */
export interface IUnionOnRecordEndResult {
}
/**
 * 监听录音自动停止
 * @apiName onRecordEnd
 */
export declare function onRecordEnd$(params: IUnionOnRecordEndParams): Promise<IUnionOnRecordEndResult>;
export default onRecordEnd$;

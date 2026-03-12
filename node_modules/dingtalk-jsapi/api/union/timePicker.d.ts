import { ICommonAPIParams } from '../../constant/types';
/**
 * 时间选择器 请求参数定义
 * @apiName timePicker
 */
export interface IUnionTimePickerParams extends ICommonAPIParams {
    value: string;
    format: string;
}
/**
 * 时间选择器 返回结果定义
 * @apiName timePicker
 */
export interface IUnionTimePickerResult {
    value: string;
}
/**
 * 时间选择器
 * @apiName timePicker
 */
export declare function timePicker$(params: IUnionTimePickerParams): Promise<IUnionTimePickerResult>;
export default timePicker$;

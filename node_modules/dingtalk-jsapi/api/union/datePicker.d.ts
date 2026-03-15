import { ICommonAPIParams } from '../../constant/types';
/**
 * 选择日期 请求参数定义
 * @apiName datePicker
 */
export interface IUnionDatePickerParams extends ICommonAPIParams {
    format: string;
    currentDate: string;
}
/**
 * 选择日期 返回结果定义
 * @apiName datePicker
 */
export interface IUnionDatePickerResult {
    date: string;
}
/**
 * 选择日期
 * @apiName datePicker
 */
export declare function datePicker$(params: IUnionDatePickerParams): Promise<IUnionDatePickerResult>;
export default datePicker$;

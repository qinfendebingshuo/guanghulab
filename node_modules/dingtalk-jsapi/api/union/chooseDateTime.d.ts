import { ICommonAPIParams } from '../../constant/types';
/**
 * 月历组件：选择日期和时间 请求参数定义
 * @apiName chooseDateTime
 */
export interface IUnionChooseDateTimeParams extends ICommonAPIParams {
    default: number;
}
/**
 * 月历组件：选择日期和时间 返回结果定义
 * @apiName chooseDateTime
 */
export interface IUnionChooseDateTimeResult {
    chosen: number;
    timezone: number;
}
/**
 * 月历组件：选择日期和时间
 * @apiName chooseDateTime
 */
export declare function chooseDateTime$(params: IUnionChooseDateTimeParams): Promise<IUnionChooseDateTimeResult>;
export default chooseDateTime$;
